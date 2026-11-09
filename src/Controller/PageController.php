<?php

namespace App\Controller;

use App\Entity\TeamMember;
use App\Repository\ChecklistStepRepository;
use App\Repository\NewsItemRepository;
use App\Repository\TeamMemberRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class PageController extends AbstractController
{
    #[Route('/', name: 'app_home')]
    public function home(TeamMemberRepository $team, ChecklistStepRepository $steps): Response
    {
        $members = $team->ordered();
        // a profile counts as complete once it has a photo, a role and a biography
        $complete = array_filter($members, static fn (TeamMember $m): bool => $m->getPhoto() && $m->getRole() && trim($m->getBio()));

        return $this->render('page/home.html.twig', [
            'team' => ['total' => \count($members), 'complete' => \count($complete)],
            'steps' => $steps->ordered(),
        ]);
    }

    #[Route('/team', name: 'app_team')]
    public function team(TeamMemberRepository $team): Response
    {
        return $this->render('page/team.html.twig', ['members' => $team->ordered()]);
    }

    #[Route('/contact', name: 'app_contact')]
    public function contact(): Response
    {
        return $this->render('page/contact.html.twig');
    }

    #[Route('/about', name: 'app_about')]
    public function about(NewsItemRepository $news): Response
    {
        return $this->render('page/about.html.twig', ['news' => $news->latest(3)]);
    }

    #[Route('/archives', name: 'app_archives')]
    public function archives(NewsItemRepository $news): Response
    {
        return $this->render('page/archives.html.twig', ['news' => $news->latest()]);
    }
}
