<?php

namespace App\Controller\Admin;

use App\Entity\ChecklistStep;
use App\Form\ChecklistStepType;
use App\Repository\ChecklistStepRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin/checklist', name: 'admin_checklist_')]
#[IsGranted('ROLE_ADMIN')]
final class ChecklistController extends AbstractController
{
    #[Route('', name: 'index')]
    public function index(ChecklistStepRepository $repo): Response
    {
        return $this->render('admin/checklist/index.html.twig', ['steps' => $repo->ordered()]);
    }

    #[Route('/new', name: 'new', methods: ['GET', 'POST'])]
    public function new(Request $request, EntityManagerInterface $em, ChecklistStepRepository $repo): Response
    {
        $step = (new ChecklistStep())->setPosition($repo->count([]) + 1);

        return $this->handle($request, $em, $step, 'Nouvelle étape');
    }

    #[Route('/{id}/edit', name: 'edit', requirements: ['id' => '\d+'], methods: ['GET', 'POST'])]
    public function edit(Request $request, EntityManagerInterface $em, ChecklistStep $step): Response
    {
        return $this->handle($request, $em, $step, 'Modifier l\'étape');
    }

    #[Route('/{id}/delete', name: 'delete', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function delete(Request $request, EntityManagerInterface $em, ChecklistStep $step): Response
    {
        if ($this->isCsrfTokenValid('delete_step_'.$step->getId(), (string) $request->request->get('_token'))) {
            $em->remove($step);
            $em->flush();
            $this->addFlash('success', 'Étape supprimée.');
        }

        return $this->redirectToRoute('admin_checklist_index');
    }

    private function handle(Request $request, EntityManagerInterface $em, ChecklistStep $step, string $title): Response
    {
        $form = $this->createForm(ChecklistStepType::class, $step)->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($step);
            $em->flush();
            $this->addFlash('success', 'Étape enregistrée.');

            return $this->redirectToRoute('admin_checklist_index');
        }

        return $this->render('admin/checklist/form.html.twig', [
            'form' => $form,
            'title' => $title,
        ], new Response(status: $form->isSubmitted() ? 422 : 200));
    }
}
