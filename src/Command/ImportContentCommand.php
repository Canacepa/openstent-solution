<?php

namespace App\Command;

use App\Entity\ChecklistStep;
use App\Entity\NewsItem;
use App\Entity\TeamMember;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Loads a file written by app:export-content. It refuses to touch non-empty tables without --force. */
#[AsCommand(name: 'app:import-content', description: 'Import the news, the team and the checklist from a JSON file')]
final class ImportContentCommand
{
    private const CLASSES = [NewsItem::class, TeamMember::class, ChecklistStep::class];

    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument('File written by app:export-content')] string $file = 'var/content-export.json',
        #[Option('Replace the content already in the database')] bool $force = false,
    ): int {
        if (!is_file($file) || !is_readable($file)) {
            $io->error(sprintf('Cannot read "%s".', $file));

            return Command::FAILURE;
        }

        try {
            $data = json_decode((string) file_get_contents($file), true, 8, \JSON_THROW_ON_ERROR);
            $this->assertShape($data);
        } catch (\JsonException|\InvalidArgumentException $e) {
            $io->error('Invalid export file: '.$e->getMessage());

            return Command::FAILURE;
        }

        $existing = 0;
        foreach (self::CLASSES as $class) {
            $existing += $this->em->getRepository($class)->count([]);
        }
        if ($existing > 0 && !$force) {
            $io->error(sprintf('The database already holds %d content rows. Use --force to replace them.', $existing));

            return Command::FAILURE;
        }

        $this->em->wrapInTransaction(function () use ($data): void {
            foreach (self::CLASSES as $class) {
                foreach ($this->em->getRepository($class)->findAll() as $row) {
                    $this->em->remove($row);
                }
            }
            $this->em->flush();

            foreach ($data['news'] as $n) {
                $this->em->persist((new NewsItem())
                    ->setTitle($n['title'])->setSummary($n['summary'])->setDateLabel($n['dateLabel'])
                    ->setPublishedAt(new \DateTimeImmutable($n['publishedAt'])));
            }
            foreach ($data['team'] as $m) {
                // basename(): a stored file name is never trusted as a path
                $this->em->persist((new TeamMember())
                    ->setName($m['name'])->setRole($m['role'])->setBio($m['bio'])
                    ->setPhoto(isset($m['photo']) ? basename($m['photo']) : null)->setPosition((int) $m['position']));
            }
            foreach ($data['checklist'] as $s) {
                $this->em->persist((new ChecklistStep())
                    ->setTitle($s['title'])->setText($s['text'] ?? '')->setStatus($s['status'])->setPosition((int) $s['position']));
            }
            $this->em->flush();
        });

        $io->success(sprintf('%d news, %d team members, %d checklist steps imported.',
            \count($data['news']), \count($data['team']), \count($data['checklist'])));

        return Command::SUCCESS;
    }

    private function assertShape(mixed $data): void
    {
        if (!\is_array($data) || ($data['format'] ?? null) !== ExportContentCommand::FORMAT) {
            throw new \InvalidArgumentException('unknown format.');
        }
        $required = [
            'news' => ['title', 'summary', 'dateLabel', 'publishedAt'],
            'team' => ['name', 'role', 'bio', 'position'],
            'checklist' => ['title', 'status', 'position'],
        ];
        foreach ($required as $section => $keys) {
            if (!isset($data[$section]) || !\is_array($data[$section])) {
                throw new \InvalidArgumentException(sprintf('missing "%s" section.', $section));
            }
            foreach ($data[$section] as $i => $row) {
                foreach ($keys as $key) {
                    if (!\is_array($row) || !isset($row[$key])) {
                        throw new \InvalidArgumentException(sprintf('"%s" row %d lacks "%s".', $section, $i, $key));
                    }
                }
            }
        }
        foreach ($data['checklist'] as $i => $row) {
            if (!\in_array($row['status'], [ChecklistStep::DONE, ChecklistStep::CURRENT, ChecklistStep::TODO], true)) {
                throw new \InvalidArgumentException(sprintf('checklist row %d has an unknown status.', $i));
            }
        }
    }
}
