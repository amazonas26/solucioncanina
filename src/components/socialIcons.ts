import { createLucideIcon, type IconNode, type LucideIcon } from 'lucide-react';
import type { SocialProfileName } from '../utils/seo';

/** Instagram histórico de Lucide (el set actual ya no incluye marcas). */
const instagramNode: IconNode = [
  ['rect', { width: '20', height: '20', x: '2', y: '2', rx: '5', ry: '5' }],
  ['path', { d: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z' }],
  ['line', { x1: '17.5', x2: '17.51', y1: '6.5', y2: '6.5' }],
];

const pinterestNode: IconNode = [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'M8 20 12 11' }],
  ['path', { d: 'M10.7 14c.44 1.6 1.6 2.5 2.55 2.5 2.07 0 3.75-1.55 3.75-4a5 5 0 1 0-9.7 1.7' }],
];

/** Facebook histórico de Lucide, listo para cuando se añada el perfil. */
const facebookNode: IconNode = [
  ['path', { d: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' }],
];

export const SOCIAL_ICONS: Record<SocialProfileName, LucideIcon> = {
  Instagram: createLucideIcon('instagram', instagramNode),
  Pinterest: createLucideIcon('pinterest', pinterestNode),
  Facebook: createLucideIcon('facebook', facebookNode),
};
