<?php

namespace App\Form;

use App\Entity\NewsItem;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class NewsItemType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('title', TextType::class, ['label' => 'Titre'])
            ->add('dateLabel', TextType::class, ['label' => 'Date affichée', 'help' => 'Ex. « Mars 2024 »'])
            ->add('publishedAt', DateType::class, [
                'label' => 'Date de tri',
                'widget' => 'single_text',
                'input' => 'datetime_immutable',
                'help' => 'Les actualités les plus récentes passent en premier.',
            ])
            ->add('summary', TextareaType::class, ['label' => 'Résumé', 'attr' => ['rows' => 4]]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => NewsItem::class]);
    }
}
