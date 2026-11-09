<?php

namespace App\Controller\Admin;

use App\Entity\TeamMember;
use App\Form\TeamMemberType;
use App\Repository\TeamMemberRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin/team', name: 'admin_team_')]
#[IsGranted('ROLE_ADMIN')]
final class TeamController extends AbstractController
{
    public function __construct(
        #[Autowire('%kernel.project_dir%/public/uploads/team')]
        private readonly string $uploadDir,
    ) {
    }

    #[Route('', name: 'index')]
    public function index(TeamMemberRepository $repo): Response
    {
        return $this->render('admin/team/index.html.twig', ['members' => $repo->ordered()]);
    }

    #[Route('/new', name: 'new', methods: ['GET', 'POST'])]
    public function new(Request $request, EntityManagerInterface $em, TeamMemberRepository $repo): Response
    {
        $member = (new TeamMember())->setPosition(\count($repo->findAll()) + 1);

        return $this->handle($request, $em, $member, 'Nouveau membre');
    }

    #[Route('/{id}/edit', name: 'edit', requirements: ['id' => '\d+'], methods: ['GET', 'POST'])]
    public function edit(Request $request, EntityManagerInterface $em, TeamMember $member): Response
    {
        return $this->handle($request, $em, $member, 'Modifier ' . $member->getName());
    }

    #[Route('/{id}/delete', name: 'delete', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function delete(Request $request, EntityManagerInterface $em, TeamMember $member): Response
    {
        if ($this->isCsrfTokenValid('delete_team_'.$member->getId(), (string) $request->request->get('_token'))) {
            $this->removePhoto($member->getPhoto());
            $em->remove($member);
            $em->flush();
            $this->addFlash('success', 'Membre supprimé.');
        }

        return $this->redirectToRoute('admin_team_index');
    }

    private function handle(Request $request, EntityManagerInterface $em, TeamMember $member, string $title): Response
    {
        $form = $this->createForm(TeamMemberType::class, $member)->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            /** @var UploadedFile|null $file */
            $file = $form->get('photoFile')->getData();
            if ($file) {
                $old = $member->getPhoto();
                // the extension comes from the validated MIME type, never from the client's file name
                $name = bin2hex(random_bytes(12)).'.'.$file->guessExtension();
                $file->move($this->uploadDir, $name);
                $member->setPhoto($name);
                $this->removePhoto($old);
            }

            $em->persist($member);
            $em->flush();
            $this->addFlash('success', 'Membre enregistré.');

            return $this->redirectToRoute('admin_team_index');
        }

        return $this->render('admin/team/form.html.twig', [
            'form' => $form,
            'title' => $title,
            'member' => $member,
        ], new Response(status: $form->isSubmitted() ? 422 : 200));
    }

    private function removePhoto(?string $photo): void
    {
        // basename(): the stored value is never trusted as a path
        if ($photo) {
            (new Filesystem())->remove($this->uploadDir.'/'.basename($photo));
        }
    }
}
