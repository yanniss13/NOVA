#!/usr/bin/env python3
"""Convertit les images PNG déclarées par le snapshot de contenu jouable.

L'export FModel reste une entrée locale, jamais une dépendance du site. Le
snapshot est la seule liste de fichiers importés : le script ne parcourt pas
le dossier d'export à la recherche d'images supplémentaires.
"""

from __future__ import annotations

import json
import os
import pathlib
import tempfile
from collections.abc import Mapping

from PIL import Image


ALLOWED_TARGETS = (
    "7ds-personnages/",
    "7ds-ui/skills/",
    "7ds-armures-ssr/Armure liee/",
)


def _normalise_relative(value: object, *, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} asset invalide : {value!r}")
    return value.replace("\\", "/")


def safe_target(repo_root: pathlib.Path | str, relative: str) -> pathlib.Path:
    """Retourne une cible dans une des racines d'assets autorisées."""

    relative = _normalise_relative(relative, label="cible")
    candidate = pathlib.PureWindowsPath(relative)
    if candidate.is_absolute() or not relative.startswith(ALLOWED_TARGETS):
        raise ValueError(f"cible asset interdite : {relative}")

    root = pathlib.Path(repo_root).resolve()
    target = (root / pathlib.Path(relative)).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"cible asset interdite : {relative}") from exc
    allowed_root_name = next(prefix for prefix in ALLOWED_TARGETS if relative.startswith(prefix))
    allowed_root = (root / pathlib.Path(allowed_root_name.rstrip("/"))).resolve()
    try:
        target.relative_to(allowed_root)
    except ValueError as exc:
        raise ValueError(f"cible asset interdite : {relative}") from exc
    return target


def _source_root(export_root: pathlib.Path | str) -> pathlib.Path:
    root = pathlib.Path(export_root).resolve()
    ui_root = root / "UIImg"
    # The public function is convenient in tests with either Content or its
    # UIImg child. In production DONNEES_JEU always points to Content.
    return ui_root if ui_root.is_dir() else root


def _safe_source(export_root: pathlib.Path | str, relative: str) -> pathlib.Path:
    relative = _normalise_relative(relative, label="source")
    source_root = _source_root(export_root)
    candidate = pathlib.PureWindowsPath(relative)
    if candidate.is_absolute():
        raise ValueError(f"source asset interdite : {relative}")
    source = (source_root / pathlib.Path(relative)).resolve()
    try:
        source.relative_to(source_root)
    except ValueError as exc:
        raise ValueError(f"source asset interdite : {relative}") from exc
    if not source.is_file():
        raise ValueError(f"source absente : {relative}")
    return source


def _asset_descriptors(snapshot: Mapping[str, object]) -> list[Mapping[str, object]]:
    if snapshot.get("version") != 1:
        raise ValueError("snapshot absent ou version incompatible")
    heroes = snapshot.get("heroes")
    if not isinstance(heroes, Mapping) or not heroes:
        raise ValueError("snapshot sans héros")

    descriptors: list[Mapping[str, object]] = []
    for hero_id in sorted(heroes):
        hero = heroes[hero_id]
        if not isinstance(hero, Mapping):
            raise ValueError(f"fiche héros invalide : {hero_id}")
        assets = hero.get("assets")
        if not isinstance(assets, Mapping):
            raise ValueError(f"assets absents : {hero_id}")

        portrait = assets.get("portrait")
        if portrait is not None:
            if not isinstance(portrait, Mapping):
                raise ValueError(f"portrait asset invalide : {hero_id}")
            descriptors.append(portrait)

        for kind in ("skills", "linkedArmors"):
            entries = assets.get(kind, [])
            if not isinstance(entries, list):
                raise ValueError(f"liste d'assets invalide : {kind}")
            for entry in entries:
                if not isinstance(entry, Mapping):
                    raise ValueError(f"asset invalide : {kind}")
                descriptors.append(entry)

        # commonSkills is deliberately metadata only: these files already
        # belong to the repository and have no source to convert.

    return descriptors


def _prepare(snapshot: Mapping[str, object], export_root: pathlib.Path | str,
             repo_root: pathlib.Path | str) -> list[tuple[pathlib.Path, pathlib.Path]]:
    prepared: list[tuple[pathlib.Path, pathlib.Path]] = []
    seen: set[str] = set()
    for descriptor in _asset_descriptors(snapshot):
        source_name = _normalise_relative(descriptor.get("source"), label="source")
        target_name = _normalise_relative(descriptor.get("target"), label="cible")
        target = safe_target(repo_root, target_name)
        # Compare normalised declaration paths so slash variants cannot alias
        # the same target on Windows.
        target_key = target.as_posix().casefold()
        if target_key in seen:
            raise ValueError(f"cible asset dupliquée : {target_name}")
        seen.add(target_key)
        source = _safe_source(export_root, source_name)
        if target.exists():
            if not target.is_file():
                raise ValueError(f"cible asset occupée par un dossier : {target_name}")
            # Les assets communs sont déjà versionnés. Ne jamais les réencoder
            # ni leur faire perdre une éventuelle différence de provenance.
            continue
        prepared.append((source, target))
    return prepared


def _encode_webp(source: pathlib.Path, temporary: pathlib.Path) -> None:
    with Image.open(source) as image:
        image.convert("RGBA").save(temporary, format="WEBP", lossless=True)


def convert_png(source: pathlib.Path | str, target: pathlib.Path | str) -> None:
    """Convertit une image et remplace sa cible par une opération atomique."""

    target = pathlib.Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{target.name}.", suffix=".tmp", dir=target.parent, delete=False
        ) as temporary:
            temporary_name = temporary.name
        _encode_webp(pathlib.Path(source), pathlib.Path(temporary_name))
        pathlib.Path(temporary_name).replace(target)
        temporary_name = None
    finally:
        if temporary_name:
            pathlib.Path(temporary_name).unlink(missing_ok=True)


def import_assets(snapshot_path: pathlib.Path | str | Mapping[str, object],
                 export_root: pathlib.Path | str,
                 repo_root: pathlib.Path | str) -> list[pathlib.Path]:
    """Importe exactement les assets déclarés et renvoie leurs chemins.

    Toutes les sources et cibles sont validées avant de créer un fichier. Les
    images sont ensuite encodées dans des temporaires placés à côté des
    cibles, puis chaque remplacement est atomique.
    """

    if isinstance(snapshot_path, Mapping):
        snapshot = snapshot_path
    else:
        snapshot_file = pathlib.Path(snapshot_path)
        with snapshot_file.open("r", encoding="utf-8") as stream:
            snapshot = json.load(stream)
    if not isinstance(snapshot, Mapping):
        raise ValueError("snapshot JSON invalide")

    prepared = _prepare(snapshot, export_root, repo_root)
    if not prepared:
        return []

    temporaries: list[tuple[pathlib.Path, pathlib.Path]] = []
    try:
        for source, target in prepared:
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                prefix=f".{target.name}.", suffix=".tmp", dir=target.parent, delete=False
            ) as temporary:
                temporary_path = pathlib.Path(temporary.name)
            try:
                _encode_webp(source, temporary_path)
            except Exception:
                temporary_path.unlink(missing_ok=True)
                raise
            temporaries.append((temporary_path, target))

        for temporary, target in temporaries:
            temporary.replace(target)
        return [target for _, target in prepared]
    finally:
        for temporary, _ in temporaries:
            temporary.unlink(missing_ok=True)


def main() -> None:
    export_root = os.environ.get("DONNEES_JEU")
    if not export_root:
        raise SystemExit("DONNEES_JEU doit désigner le dossier Content exporté")
    root = pathlib.Path(__file__).resolve().parents[2]
    snapshot = root / "7ds-stats" / "contenu-jeu.json"
    outputs = import_assets(snapshot, export_root, root)
    for output in outputs:
        print(f"écrit : {output.relative_to(root).as_posix()}")
    print(f"{len(outputs)} asset(s) importé(s)")


if __name__ == "__main__":
    main()
