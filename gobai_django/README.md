# Gobai Django — site vitrine servant le jeu pygbag

Application Django minimale qui publie le prototype pygame
([`../gobai_pygame`](../gobai_pygame)) compilé en WebAssembly avec
[pygbag](https://pypi.org/project/pygbag/), intégré à une page HTML via une
`<iframe>`.

## Architecture

```
gobai_pygame/            moteur de simulation (Python pur + pygame)
  gobai/kepler.py        mathématiques képlériennes (espace physique)
  gobai/simulation.py    positions monde en UA, sans pygame ni Django
  main.py                UI pygame (espace écran uniquement)
gobai_django/            publication web
  game/static/game/      sortie du build pygbag (index.html + paquet .apk)
  game/templates/        page vitrine avec l'iframe
  game/tests.py          tests d'intégration (page + statiques)
```

Le runtime WebAssembly (python, pygame-ce) n'est pas embarqué : l'`index.html`
généré par pygbag le charge depuis le CDN officiel `pygame-web.github.io`. Le
paquet `gobai_pygame.apk` (≈ 12 Ko) contient les sources Python du jeu, zippées.
Le calcul astronomique s'exécute donc entièrement dans le navigateur, en
WebAssembly : Django ne sert que des fichiers, sans calcul ni requête réseau
pour la simulation.

## Lancement

```bash
pip install -r requirements.txt
python3 manage.py collectstatic --noinput
python3 manage.py runserver
```

Le jeu est servi sur `http://127.0.0.1:8000/`.

## Reconstruire le jeu après modification

```bash
pip install pygbag
cd ../gobai_pygame
pygbag --build main.py
cp -r build/web/* ../gobai_django/game/static/game/
```

## Tests

```bash
python3 manage.py test
```

Vérifie la page d'accueil (iframe présente) et la disponibilité des fichiers
pygbag (`index.html`, paquet `.apk`).

## Limites connues

- Le service statique via `django.views.static.serve` convient au développement
  et à une petite vitrine ; pour la production, préférer un serveur frontal
  (nginx) ou WhiteNoise devant `STATIC_ROOT`.
- La clé secrète se lit dans `DJANGO_SECRET_KEY` (repli de développement
  uniquement) ; `DJANGO_DEBUG=0` et `DJANGO_ALLOWED_HOSTS` pour la production.
