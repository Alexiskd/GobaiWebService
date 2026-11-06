import { SvgIcon } from '@mui/material';

// Icônes Material (tracés officiels), sans dépendance à @mui/icons-material.
const icon = (path, name) => {
  const Icon = (props) => <SvgIcon {...props}><path d={path} /></SvgIcon>;
  Icon.displayName = name;
  return Icon;
};

export const CloseIcon = icon('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z', 'CloseIcon');
export const AddIcon = icon('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z', 'AddIcon');
export const RemoveIcon = icon('M19 13H5v-2h14z', 'RemoveIcon');
export const ExpandLessIcon = icon('m12 8-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z', 'ExpandLessIcon');
export const ExpandMoreIcon = icon('M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z', 'ExpandMoreIcon');
export const DragIndicatorIcon = icon('M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2m-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2', 'DragIndicatorIcon');
export const InfoIcon = icon('M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8', 'InfoIcon');
