<?php

namespace App\Controller;

use App\Repository\NewsItemRepository;
use App\Repository\TeamMemberRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class PageController extends AbstractController
{
    #[Route('/', name: 'app_home')]
    public function home(NewsItemRepository $news): Response
    {
        return $this->render('page/home.html.twig', ['news' => $news->latest(3)]);
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
    public function about(): Response
    {
        return $this->render('page/about.html.twig');
    }
}
