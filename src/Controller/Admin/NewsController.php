<?php

namespace App\Controller\Admin;

use App\Entity\NewsItem;
use App\Form\NewsItemType;
use App\Repository\NewsItemRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin/news', name: 'admin_news_')]
#[IsGranted('ROLE_ADMIN')]
final class NewsController extends AbstractController
{
    #[Route('', name: 'index')]
    public function index(NewsItemRepository $repo): Response
    {
        return $this->render('admin/news/index.html.twig', ['items' => $repo->latest()]);
    }

    #[Route('/new', name: 'new', methods: ['GET', 'POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $item = (new NewsItem())->setPublishedAt(new \DateTimeImmutable('today'));

        return $this->handle($request, $em, $item, 'Nouvelle actualité');
    }

    #[Route('/{id}/edit', name: 'edit', requirements: ['id' => '\d+'], methods: ['GET', 'POST'])]
    public function edit(Request $request, EntityManagerInterface $em, NewsItem $item): Response
    {
        return $this->handle($request, $em, $item, 'Modifier l\'actualité');
    }

    #[Route('/{id}/delete', name: 'delete', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function delete(Request $request, EntityManagerInterface $em, NewsItem $item): Response
    {
        if ($this->isCsrfTokenValid('delete_news_'.$item->getId(), (string) $request->request->get('_token'))) {
            $em->remove($item);
            $em->flush();
            $this->addFlash('success', 'Actualité supprimée.');
        }

        return $this->redirectToRoute('admin_news_index');
    }

    private function handle(Request $request, EntityManagerInterface $em, NewsItem $item, string $title): Response
    {
        $form = $this->createForm(NewsItemType::class, $item)->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($item);
            $em->flush();
            $this->addFlash('success', 'Actualité enregistrée.');

            return $this->redirectToRoute('admin_news_index');
        }

        return $this->render('admin/news/form.html.twig', [
            'form' => $form,
            'title' => $title,
        ], new Response(status: $form->isSubmitted() ? 422 : 200));
    }
}
