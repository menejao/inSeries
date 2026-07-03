import { CheckCircleIcon, FilmIcon, FlameIcon, HeartIcon, ListIcon, PlayIcon, StarIcon, TrophyIcon, UserIcon, type IconProps } from "@/components/ui/icons";

/** Resolves the symbolic `icon` string stored on Achievement (lib/gamification/achievements.ts) to an actual icon component. */
const ICONS: Record<string, (props: IconProps) => React.ReactElement> = {
  play: PlayIcon,
  film: FilmIcon,
  trophy: TrophyIcon,
  heart: HeartIcon,
  flame: FlameIcon,
  "check-circle": CheckCircleIcon,
  star: StarIcon,
  list: ListIcon,
  user: UserIcon
};

export function AchievementIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? TrophyIcon;
  return <Icon className={className} />;
}
