<?php

namespace App\Form;

use App\Entity\ChecklistStep;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class ChecklistStepType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('title', TextType::class, ['label' => 'Titre'])
            ->add('text', TextareaType::class, [
                'label' => 'Description',
                'required' => false,
                'attr' => ['rows' => 3],
            ])
            ->add('status', ChoiceType::class, [
                'label' => 'Statut',
                'choices' => [
                    'Terminée' => ChecklistStep::DONE,
                    'En cours' => ChecklistStep::CURRENT,
                    'À venir' => ChecklistStep::TODO,
                ],
                'help' => 'Une étape terminée apparaît cochée sur la page d\'accueil.',
            ])
            ->add('position', IntegerType::class, [
                'label' => 'Ordre d\'affichage',
                'help' => 'Le plus petit numéro s\'affiche en premier (après « Création de l\'équipe »).',
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => ChecklistStep::class]);
    }
}
