<?php

namespace App\Command;

use App\Entity\ChecklistStep;
use App\Entity\NewsItem;
use App\Entity\TeamMember;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Filesystem\Filesystem;

/**
 * Writes the editable content (news, team, checklist) to a JSON file, to move it to another
 * environment with app:import-content. Users and passwords are never exported.
 */
#[AsCommand(name: 'app:export-content', description: 'Export the news, the team and the checklist to a JSON file')]
final class ExportContentCommand
{
    public const FORMAT = 1;

    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument('Target file')] string $file = 'var/content-export.json',
    ): int {
        $data = [
            'format' => self::FORMAT,
            'news' => array_map(static fn (NewsItem $n): array => [
                'title' => $n->getTitle(),
                'summary' => $n->getSummary(),
                'dateLabel' => $n->getDateLabel(),
                'publishedAt' => $n->getPublishedAt()?->format('Y-m-d'),
            ], $this->em->getRepository(NewsItem::class)->findBy([], ['id' => 'ASC'])),
            'team' => array_map(static fn (TeamMember $m): array => [
                'name' => $m->getName(),
                'role' => $m->getRole(),
                'bio' => $m->getBio(),
                'photo' => $m->getPhoto(),
                'position' => $m->getPosition(),
            ], $this->em->getRepository(TeamMember::class)->findBy([], ['position' => 'ASC', 'id' => 'ASC'])),
            'checklist' => array_map(static fn (ChecklistStep $s): array => [
                'title' => $s->getTitle(),
                'text' => $s->getText(),
                'status' => $s->getStatus(),
                'position' => $s->getPosition(),
            ], $this->em->getRepository(ChecklistStep::class)->findBy([], ['position' => 'ASC', 'id' => 'ASC'])),
        ];

        (new Filesystem())->dumpFile($file, json_encode($data, \JSON_PRETTY_PRINT | \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES | \JSON_THROW_ON_ERROR)."\n");

        $io->success(sprintf('%d news, %d team members, %d checklist steps written to %s.',
            \count($data['news']), \count($data['team']), \count($data['checklist']), $file));
        $io->note('Team photos are files: copy public/uploads/team/ alongside (scripts/preprod-migrate-data.sh does it).');

        return Command::SUCCESS;
    }
}
