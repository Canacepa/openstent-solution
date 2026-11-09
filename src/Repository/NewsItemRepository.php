<?php

namespace App\Repository;

use App\Entity\NewsItem;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<NewsItem> */
class NewsItemRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, NewsItem::class);
    }

    /** @return list<NewsItem> newest first */
    public function latest(?int $limit = null): array
    {
        return $this->findBy([], ['publishedAt' => 'DESC', 'id' => 'DESC'], $limit);
    }
}
