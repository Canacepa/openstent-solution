<?php

namespace App\Entity;

use App\Repository\ChecklistStepRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/** A step of the project checklist shown on the home page. */
#[ORM\Entity(repositoryClass: ChecklistStepRepository::class)]
class ChecklistStep
{
    public const DONE = 'done';
    public const CURRENT = 'current';
    public const TODO = 'todo';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 160)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 160)]
    private string $title = '';

    #[ORM\Column(type: Types::TEXT)]
    #[Assert\Length(max: 500)]
    private string $text = '';

    #[ORM\Column(length: 16)]
    #[Assert\Choice(choices: [self::DONE, self::CURRENT, self::TODO])]
    private string $status = self::TODO;

    /** Display order, lowest first. */
    #[ORM\Column]
    private int $position = 0;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;

        return $this;
    }

    public function getText(): string
    {
        return $this->text;
    }

    public function setText(?string $text): static
    {
        $this->text = $text ?? '';

        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;

        return $this;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): static
    {
        $this->position = $position;

        return $this;
    }
}
