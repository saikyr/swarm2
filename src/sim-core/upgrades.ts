import type { UpgradeCard } from '../rendering/ui';

export function serializeUpgradeCards(cards: UpgradeCard[]): Array<{
  index: number;
  id: string;
  name: string;
  description: string;
  rarity: string;
  cardType?: string;
  weaponId?: string;
  weaponName?: string;
  overclockTier?: string;
}> {
  return cards.map((c, index) => ({
    index,
    id: c.id,
    name: c.name,
    description: c.description,
    rarity: c.rarity,
    cardType: c.type,
    weaponId: c.weaponId,
    weaponName: c.weaponName,
    overclockTier: c.overclockTier,
  }));
}
