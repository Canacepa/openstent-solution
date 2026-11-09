<?php

namespace App\Command;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Validator\Constraints\Email;
use Symfony\Component\Validator\Validation;

#[AsCommand(name: 'app:create-admin', description: 'Create an admin user, or reset the password of an existing one')]
final class CreateAdminCommand
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserPasswordHasherInterface $hasher,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument('Email address used to log in')] string $email,
    ): int {
        if (\count(Validation::createValidator()->validate($email, new Email())) > 0) {
            $io->error('Invalid email address.');

            return Command::FAILURE;
        }

        $password = $io->askHidden('Password (at least 12 characters)', function (?string $value): string {
            if (null === $value || mb_strlen($value) < 12) {
                throw new \RuntimeException('The password must be at least 12 characters long.');
            }

            return $value;
        });

        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]) ?? (new User())->setEmail($email);
        $user->setRoles(['ROLE_ADMIN'])->setPassword($this->hasher->hashPassword($user, $password));
        $this->em->persist($user);
        $this->em->flush();

        $io->success(sprintf('Admin "%s" saved.', $email));

        return Command::SUCCESS;
    }
}
