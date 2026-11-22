// Kit d'interface du Fairing : le point d'entrée unique des composants (à la place de @mui/material).
// Tailwind CSS v4 pour le style (theme/app.css), Base UI pour le comportement des fenêtres, infobulles, onglets
// et curseur, des éléments HTML natifs pour tout le reste.

// Classes : réunion de morceaux.
export { cx } from './cx.js';
// Composants sans dépendance.
export {
  Alert, Button, ButtonGroup, Checkbox, Chip, CircularProgress, Collapse, FormControlLabel, IconButton, InputBase, Link,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, MenuItem, Popper, Radio, Skeleton, Switch,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery,
} from './primitives.jsx';
// Composants portés par Base UI.
export { Dialog, DialogContent, Drawer, Slider, Tab, Tabs, Tooltip, TooltipProvider } from './overlays.jsx';
