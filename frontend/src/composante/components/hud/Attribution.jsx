
/**
 * Onglet « API » : inventaire des API externes utilisées par Gobai.
 * Consultation uniquement : aucune commande de connexion ou déconnexion.
 */
function ApiList() {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Inventaire des services externes référencés dans le code de Gobai.
        Les API sont utilisées selon les fonctionnalités activées et les
        données demandées.
      </Typography>

      {API_GROUPS.map(({ group, items }) => (
        <Box
          key={group}
          component="section"
          aria-label={group}
        >
          <SectionTitle>{group}</SectionTitle>

          <Table size="small" sx={FIT_TABLE}>
            <TableBody>
              {items.map((api) => (
                <TableRow key={api.name}>
                  <TableCell
                    sx={{
                      pl: 0,
                      verticalAlign: 'top',
                      width: '42%',
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={600}
                    >
                      {api.name}
                    </Typography>

                    <Box
                      component="span"
                      translate="no"
                      sx={{
                        display: 'block',
                        fontSize: '0.78em',
                        color: 'text.secondary',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {api.host}
                    </Box>
                  </TableCell>

                  <TableCell
                    sx={{
                      pr: 0,
                      verticalAlign: 'top',
                    }}
                  >
                    <Typography variant="body2">
                      {api.use}
                    </Typography>

                    {api.key && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Utilisation conditionnée à la configuration
                        de la clé API sur le serveur.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ))}

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 2 }}
      >
        {countApis()} API externes référencées dans le code de Gobai.
      </Typography>
    </Box>
  );
}
