<?php

namespace App\Command;

use App\Entity\ChecklistStep;
use App\Entity\NewsItem;
use App\Entity\TeamMember;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Filesystem;

/**
 * One-off import of the content that used to live in the templates, so the admin starts
 * with the current team and news. It does nothing when the tables already have rows.
 */
#[AsCommand(name: 'app:seed-content', description: 'Import the initial team and news into the database')]
final class SeedContentCommand
{
    private const NEWS = [
        ['2024-03-01', 'Mars 2024', 'Campagne de financement participatif', 'Lancement du tour pré-série A sur Capital Cell.'],
        ['2023-01-01', '2023', 'Lauréate Hauts-de-France', 'Open Stent Solution est distinguée parmi les projets innovants de la région.'],
        ['2022-03-01', 'Mars 2022', 'Parmi les 100 start-up où investir', 'Sélection du magazine Challenges, après un article sur la promesse du remplacement valvulaire transcathéter.'],
    ];

    private const CHECKLIST = [
        [ChecklistStep::DONE, 'Conception de la Cornelis™ Valve', 'Le principe du ruban valvé est défini.'],
        [ChecklistStep::DONE, 'Essais de faisabilité sur banc', 'Déploiement, fermeture, étanchéité et tenue en fatigue démontrés.'],
        [ChecklistStep::DONE, "Essais de faisabilité sur l'animal", "Positionnement, verrouillage dans l'anneau et hémodynamique prometteurs."],
        [ChecklistStep::CURRENT, 'Finalisation de la conception', 'Les derniers ajustements de la valve sont en cours.'],
        [ChecklistStep::TODO, 'Études animales complémentaires', 'Prévues en 2025.'],
        [ChecklistStep::TODO, 'Tests réglementaires', "Vérification et validation, avant tout essai chez l'humain."],
        [ChecklistStep::TODO, "Premiers essais chez l'humain", "Pas encore : la valve n'est pas approuvée."],
    ];

    private const TEAM = [
        ['doron-carmi', 'Doron Carmi', 'MD, Msc - Fondateur & CEO', "Avec plus de 20 ans d'expertise dans les maladies des valves cardiaques et les dispositifs de cardiologie, Doron est aujourd'hui le fondateur et CEO d'Open Stent Solution. Reconnu en tant que chirurgien cardiaque et inventeur de la technologie de la valve Cornelis™, il révolutionne les soins cardiaques avec un engagement envers l'innovation. Le leadership de Doron va au-delà de l'excellence clinique, mettant en avant une planification financière stratégique, une gestion budgétaire et des négociations de contrats habiles pour une croissance durable dans l'industrie compétitive des technologies médicales."],
        ['hikmat-hojeibane', 'Hikmat Hojeibane', 'Directeur R&D et CTO - MSc, BSc', "Hikmat est le directeur technique (CTO), mettant à profit plus de 25 ans d'expertise en matière d'innovation dans le domaine des dispositifs médicaux cardiovasculaires. Il est reconnu pour son rôle essentiel dans la direction de la recherche et du développement de start-ups et de grandes entreprises, avec une expérience réussie dans le développement et la commercialisation de systèmes interventionnels transcathéters. La vaste expérience d'Hikmat chez Cordis et Johnson & Johnson comprend la conception de stents flexibles et d'autres dispositifs d'intervention innovants, avec plus de 30 brevets accordés aux États-Unis et 70 brevets internationaux."],
        ['matthieu-leroy', 'Matthieu Leroy', 'Cathéter Project Leader', "Matthieu Leroy est un ingénieur en mécanique spécialisé dans le développement de produits complexes et la gestion de projets. Actuellement en poste en tant que chef de projet cathéter chez Open Stent Solution, Matthieu est responsable de la gestion du système de délivrance du dispositif de remplacement de la valve mitrale par voie transcathéter. Il apporte ses connaissances techniques, son expérience en gestion de projets, en gestion des fournisseurs et en gestion des opérations. Son rôle englobe la gestion complète du programme ainsi que les activités techniques et opérationnelles quotidiennes."],
        ['eloise-kerignard', 'Eloïse Kerignard', 'Project Leader, Biological & Polymers', "Eloïse Kerignard, cheffe de projet spécialisée dans les feuillets de valves cardiaques, apporte son expertise diversifiée en biotechnologies et sciences de la vie. Son rôle dans l'avancement des projets d'Open Stent Solution, incluant la gestion du développement des composants valvulaires, des matériaux, ainsi que la supervision de l'équipe de production des valves, démontre une compétence en gestion de projet essentielle. Cet engagement, allié à un esprit entrepreneurial, contribue de manière décisive au succès de ce projet complexe."],
        ['stephane-parsaix', 'Stéphane Parsaix', 'Ingénieur cathéter R&D', "Stéphane se distingue comme un ingénieur Cathéter R&D de premier plan dans le domaine des dispositifs médicaux, avec une solide expertise en conception de produits, micromécanique, et CAO. Au sein d'Open Stent Solution il joue un rôle décisif sur le développement du système de délivrance."],
        ['mehdi-bordji', 'Mehdi Bordji', 'Project Leader, FEA & Simulations', "Mehdi Bordji est un ingénieur R&D hautement qualifié, expérimenté et spécialisé dans l'Analyse par Éléments Finis (FEA). Avec une solide expérience dans les simulations numériques et la physique, il apporte des connaissances à l'équipe, en particulier dans les domaines de la mécanique cardiovasculaire, de l'hémodynamique et de la conception de dispositifs médicaux.\n\nA l'aide de sa maîtrise de la FEA et de la Conception Assistée par Ordinateur (CAO), il joue un rôle essentiel dans le développement de composants critiques, veillant à ce qu'ils respectent les normes requises en termes d'efficacité et de sécurité."],
        ['juliette-jonckheere', 'Juliette Jonckheere', 'Couturière de valve cardiaque', "Juliette, couturière hautement qualifiée chez Open Stent Solution, apporte une expertise approfondie en couture et en patronage. Son expérience dans l'industrie textile démontre sa polyvalence en passant de manière fluide de la mode au domaine médical. En mettant à profit son expérience, Juliette apporte des compétences précieuses à la production de solutions médicales axée sur la précision chez Open Stent Solution. Sa maîtrise de la confection textile et son souci du détail la positionnent comme un atout précieux pour garantir les normes de qualité les plus élevées dans la création de valves médicales."],
        ['alexandre-hadir', 'Alexandre Hadir', 'Project Leader, Mechanical Design', "Alexandre Hadir, ingénieur R&D et chef de projet Stent chez Open Stent Solution, apporte une expertise approfondie en ingénierie mécanique et une solide expérience dans la conception de produits à la fois automobiles et médicaux. Son parcours professionnel englobe des rôles significatifs dans le développement de produits et l'industrialisation, démontrant sa polyvalence et sa profonde connaissance en ingénierie."],
        ['melodie-bellegueule', 'Mélodie Bellegueule', 'Couturière de valve cardiaque', "Mélodie est une couturière hautement qualifiée chez Open Stent Solution, spécialisée dans la production minutieuse de valves biologiques. Sa dévotion quotidienne tourne autour de la création méticuleuse de valves avec une précision de l'ordre du millimètre, visant une reproductibilité maximale. Forte de son expérience approfondie en tant qu'artisan du cuir dans le secteur de la maroquinerie de luxe, Mélodie intègre de manière fluide ses techniques de couture dans les processus de production chez Open Stent Solution."],
        ['maurice-boulot', 'Maurice Boulot', 'Engineering & Characterization', "Maurice a travaillé pendant plus de 30 ans dans la maintenance biomédicale au Centre Hospitalier Universitaire (CHU). Actuellement, il est responsable des machines d'essai chez Open Stent Solution, testant la performance hydrodynamique et la fatigue des valves. Maurice est également chargé de la fabrication d'autres machines pour les stents et les cathéters."],
    ];

    public function __construct(
        private readonly EntityManagerInterface $em,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $fs = new Filesystem();

        if (0 === $this->em->getRepository(NewsItem::class)->count([])) {
            foreach (self::NEWS as [$date, $label, $title, $summary]) {
                $this->em->persist((new NewsItem())
                    ->setPublishedAt(new \DateTimeImmutable($date))
                    ->setDateLabel($label)
                    ->setTitle($title)
                    ->setSummary($summary));
            }
            $io->writeln('News imported.');
        }

        if (0 === $this->em->getRepository(ChecklistStep::class)->count([])) {
            foreach (self::CHECKLIST as $i => [$status, $title, $text]) {
                $this->em->persist((new ChecklistStep())
                    ->setStatus($status)->setTitle($title)->setText($text)->setPosition($i + 1));
            }
            $io->writeln('Checklist imported.');
        }

        if (0 === $this->em->getRepository(TeamMember::class)->count([])) {
            $uploads = $this->projectDir.'/public/uploads/team';
            $fs->mkdir($uploads);

            foreach (self::TEAM as $i => [$slug, $name, $role, $bio]) {
                $source = $this->projectDir.'/assets/images/team/'.$slug.'.jpg';
                $photo = null;
                if (is_file($source)) {
                    $photo = $slug.'.jpg';
                    $fs->copy($source, $uploads.'/'.$photo, true);
                }
                $this->em->persist((new TeamMember())
                    ->setName($name)->setRole($role)->setBio($bio)
                    ->setPhoto($photo)->setPosition($i + 1));
            }
            $io->writeln('Team imported.');
        }

        $this->em->flush();
        $io->success('Done.');

        return Command::SUCCESS;
    }
}
