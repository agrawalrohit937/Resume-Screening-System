"""
Tests for Cultural Name Handling and Identity Normalization.
Ensures mononyms, patronymics, particles, and non-Latin scripts are correctly handled.
"""

import pytest
from services.identity_service import parse_cultural_name, detect_script_type


def test_mononym_handling():
    # Indonesian/Indian mononyms
    rec1 = parse_cultural_name("Kavitha")
    assert rec1.is_mononym is True
    assert rec1.full_name == "Kavitha"
    assert rec1.display_name == "Kavitha"
    assert rec1.family_name is None

    rec2 = parse_cultural_name("Sukarno")
    assert rec2.is_mononym is True
    assert rec2.full_name == "Sukarno"


def test_patronymic_handling():
    # South Asian patronymics with s/o
    rec = parse_cultural_name("Kavitha S/O Ramanathan")
    assert rec.is_mononym is False
    assert rec.given_name == "Kavitha"
    assert rec.patronymic == "S/O Ramanathan"
    assert rec.display_name == "Kavitha"

    # Arabic bin lineage
    rec_ar = parse_cultural_name("Omar bin Fahad")
    assert rec_ar.is_mononym is False
    assert rec_ar.given_name == "Omar"
    assert rec_ar.patronymic == "bin Fahad"


def test_particle_surnames():
    # Dutch/German particles
    rec_nl = parse_cultural_name("Guido van Rossum")
    assert rec_nl.given_name == "Guido"
    assert rec_nl.family_name == "van Rossum"

    # Italian particles
    rec_it = parse_cultural_name("Leonardo da Vinci")
    assert rec_it.given_name == "Leonardo"
    assert rec_it.family_name == "da Vinci"

    # Arabic particles
    rec_ar = parse_cultural_name("Tariq Al-Mansoor")
    assert rec_ar.given_name == "Tariq"
    assert rec_ar.family_name == "Al-Mansoor"


def test_non_latin_scripts():
    # Devanagari
    rec_hi = parse_cultural_name("रोहित अग्रवाल")
    assert rec_hi.script_type == "devanagari"
    assert rec_hi.full_name == "रोहित अग्रवाल"
    assert rec_hi.given_name == "रोहित"
    assert rec_hi.family_name == "अग्रवाल"

    # CJK
    rec_cjk = parse_cultural_name("李雷")
    assert rec_cjk.script_type == "cjk"
    assert rec_cjk.full_name == "李雷"

    # Cyrillic
    rec_ru = parse_cultural_name("Алексей Смирнов")
    assert rec_ru.script_type == "cyrillic"
    assert rec_ru.given_name == "Алексей"
    assert rec_ru.family_name == "Смирнов"
