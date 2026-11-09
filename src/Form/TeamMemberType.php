<?php

namespace App\Form;

use App\Entity\TeamMember;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\FileType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\Image;

class TeamMemberType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class, ['label' => 'Nom'])
            ->add('role', TextType::class, ['label' => 'Poste'])
            ->add('bio', TextareaType::class, [
                'label' => 'Biographie',
                'attr' => ['rows' => 10],
                'help' => 'Texte brut : une ligne vide commence un nouveau paragraphe.',
            ])
            ->add('position', IntegerType::class, [
                'label' => 'Ordre d\'affichage',
                'help' => 'Le plus petit numéro s\'affiche en premier.',
            ])
            ->add('photoFile', FileType::class, [
                'label' => 'Photo',
                'mapped' => false,
                'required' => false,
                'help' => 'JPEG, PNG ou WebP, 5 Mo maximum. Laisser vide pour garder la photo actuelle.',
                'constraints' => [new Image(
                    maxSize: '5M',
                    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    mimeTypesMessage: 'Formats acceptés : JPEG, PNG, WebP.',
                )],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => TeamMember::class]);
    }
}
