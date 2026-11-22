"""Genera la rutina por fases (recuperación de codo + Calistenia 45).

Salidas:
  www/default-program.js   rutina incluida en la app
  <out>.xlsx               la misma rutina en el formato que la app importa

Uso: python3 tools/build_program.py <ruta_salida.xlsx>
"""
import copy
import json
import os
import re
import sys
import unicodedata

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGACY = json.load(open(os.path.join(ROOT, "tools", "legacy.json"), encoding="utf-8"))


def slug(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# ---------------------------------------------------------------- fotos
PHOTOS = {
    "pullups": "Dominada prona", "chinup": "Dominada supina", "band_pullup": "Dominada con banda",
    "scap_pull": "Colgado de la barra", "dips": "Fondos en paralelas", "dips_chest": "Fondos con torso inclinado",
    "pushup": "Flexión de brazos", "incline_pushup": "Flexión inclinada (manos en cajón)",
    "decline_pushup": "Flexión con pies en altura", "diamond": "Flexión diamante",
    "inverted_row": "Remo australiano", "facepull": "Face pull", "pull_apart": "Band pull-apart",
    "band_curl": "Curl de bíceps con banda", "bulgarian": "Sentadilla búlgara", "stepup": "Step-up",
    "box_pistol": "Sentadilla a una pierna a banco", "air_squat": "Sentadilla al aire",
    "sl_rdl": "Peso muerto a una pierna", "nordic": "Curl nórdico", "slider_curl": "Curl de isquio con balón/toalla",
    "hip_thrust": "Hip thrust", "glute_bridge": "Puente de glúteo", "sl_bridge": "Puente de glúteo a una pierna",
    "calf_raise": "Elevación de talones", "deadbug": "Dead bug", "leg_raise": "Elevación de piernas acostado",
    "reverse_crunch": "Crunch inverso", "knee_tuck": "Rodillas al pecho acostado",
    "hanging_raise": "Elevación de piernas colgado", "tuck_lsit": "Tuck L-sit en paralelas",
    "arm_circles": "Círculos de brazos", "elbow_circles": "Rotación de hombros (manos en hombros)",
    "wrist_circles": "Círculos de muñeca", "hip_flexor": "Estiramiento flexor de cadera", "cat": "Gato-camello",
}


# ---------------------------------------------------------------- ejercicios base
def ex(name, typ="reps", img=None, muscles="", tips="", easier="", harder="", safety="", perLeg=False, load=False):
    return dict(name=name, type=typ, img=img, muscles=muscles, tips=tips, easier=easier,
                harder=harder, safety=safety, perLeg=perLeg, load=load)


X = {}
X["bulg"] = ex("Sentadilla búlgara con mochila", img="bulgarian", muscles="Cuádriceps, glúteos", perLeg=True, load=True,
               tips="Mochila puesta en la espalda con las dos tiras y manos libres: no sostengas peso con los brazos. Baja hasta casi tocar el suelo con la rodilla.",
               easier="Sin peso.", harder="Más peso en la mochila o bajada de 3 s.")
X["slrdl"] = ex("Peso muerto rumano a una pierna", img="sl_rdl", muscles="Isquiotibiales, glúteos", perLeg=True, load=True,
                tips="Mochila en la espalda, no en la mano, para no cargar el codo. Cadera atrás, espalda neutra; siente el estiramiento atrás del muslo.",
                easier="Punta del otro pie apoyada atrás para equilibrio.", harder="Más peso o pausa de 2 s abajo.")
X["stepup"] = ex("Step-up alto con mochila", img="stepup", muscles="Cuádriceps, glúteos", perLeg=True, load=True,
                 tips="Mochila en la espalda. Cajón o silla de 40–50 cm. Empuja solo con la pierna de arriba y baja en 3 s.",
                 easier="Cajón más bajo.", harder="Más peso o cajón más alto.")
X["pistol"] = ex("Sentadilla a una pierna a banco", img="box_pistol", muscles="Cuádriceps, glúteos", perLeg=True, load=True,
                 tips="Siéntate controlado en un banco o silla con una pierna y sube sin impulso. Brazos al frente para equilibrar, sin agarrarte de nada.",
                 easier="Banco más alto.", harder="Banco más bajo o mochila puesta.")
X["slbridge"] = ex("Puente de glúteo a una pierna", img="sl_bridge", muscles="Glúteos, isquiotibiales", perLeg=True,
                   tips="Espalda en el suelo y brazos relajados al costado, sin empujar con ellos. Pausa de 2 s arriba.",
                   easier="Con las dos piernas.", harder="Espalda alta en el sofá (hip thrust) o pausa de 3 s.")
X["wallsit"] = ex("Sentadilla isométrica en pared", typ="time", muscles="Cuádriceps",
                  tips="Espalda pegada a la pared y rodillas a 90°. Brazos sueltos: no apoyes las manos en los muslos.",
                  easier="Rodillas a 110–120°.", harder="Una pierna más adelantada que la otra.")
X["calf"] = ex("Elevación de talones a una pierna", img="calf_raise", muscles="Pantorrillas", perLeg=True,
               tips="En el borde de un escalón. Sube en 1 s y baja en 3 s hasta estirar bien. Apoya apenas un dedo en la pared para el equilibrio.",
               easier="Con las dos piernas.", harder="Mochila puesta o pausa de 2 s arriba.")
X["slider"] = ex("Curl de isquio deslizante", img="slider_curl", muscles="Isquiotibiales",
                 tips="Boca arriba, talones sobre una toalla en piso liso. Sube la cadera y arrastra los talones hacia ti; estira lento en 3 s. Brazos al costado sin empujar. La foto muestra la versión con balón.",
                 easier="Solo la fase de estirar las piernas lento.", harder="A una pierna.")
X["deadbug"] = ex("Dead bug", img="deadbug", muscles="Core profundo, abdomen", perLeg=True,
                  tips="Boca arriba, zona lumbar pegada al suelo todo el tiempo. Estira brazo y pierna contrarios exhalando. Repeticiones por lado.",
                  easier="Mueve solo las piernas.", harder="Pausa de 3 s estirado.")
X["hollow"] = ex("Hollow body hold", typ="time", muscles="Abdomen",
                 tips="Zona lumbar pegada al suelo, piernas y hombros despegados. Brazos estirados junto al cuerpo.",
                 easier="Rodillas dobladas.", harder="Brazos estirados sobre la cabeza.")
X["legraise"] = ex("Elevación de piernas acostado", img="leg_raise", muscles="Abdomen, flexores de cadera",
                   tips="En el suelo, manos bajo los glúteos sin empujar. Sube las piernas rectas y baja en 3 s sin despegar la zona lumbar.",
                   easier="Rodillas dobladas.", harder="Bajada de 5 s o pausa a 10 cm del suelo.")
X["revcrunch"] = ex("Crunch inverso", img="reverse_crunch", muscles="Abdomen",
                    tips="Lleva las rodillas al pecho y despega la cadera del suelo enrollando la columna. Brazos al costado, sin empujar con las manos.",
                    easier="Rango más corto.", harder="Pausa de 2 s arriba.")
X["nordic"] = ex("Curl nórdico asistido", img="nordic", muscles="Isquiotibiales",
                 tips="De rodillas, talones trabados bajo un mueble. Baja en 3–5 s con la cadera estirada y recíbete con las manos solo al final.",
                 easier="Banda en la barra enganchada al pecho para frenar, o rango corto.", harder="Bajada más lenta.",
                 safety="Si recibirte con las manos molesta el codo, frena con la banda y no llegues al suelo. Nunca al fallo.")

# Tren superior: rehabilitación
X["iso_wall"] = ex("Lagartija isométrica en pared o mesón", typ="time", img="incline_pushup", muscles="Pecho, tríceps (isométrico suave)",
                   tips="Manos en la pared o en un mesón, cuerpo recto e inclinado. Baja hasta que los codos queden a unos 45° y sostén ahí. Esfuerzo suave, 2–3 de 10. Respira normal.",
                   easier="Más cerca de la pared o con los codos menos doblados.", harder="Algo más inclinado, sin bajar del mesón en esta fase.",
                   safety="Para si la molestia en el pliegue del codo pasa de 2/10.")
X["iso_row"] = ex("Remo australiano isométrico casi vertical", typ="time", img="inverted_row", muscles="Espalda media, bíceps (isométrico suave)",
                  tips="Paralelas o barra baja, cuerpo casi vertical con los pies cerca de la barra. Agarre prono o neutro. Tira hasta la mitad del recorrido y sostén.",
                  easier="Más vertical o con los codos menos doblados.", harder="Un poco más inclinado.",
                  safety="Nunca con las palmas hacia ti: el agarre supino carga más la inserción del bíceps. Para si la molestia pasa de 2/10.")
X["inc_ecc"] = ex("Lagartija inclinada en banco (bajada 3 s)", img="incline_pushup", muscles="Pecho, tríceps",
                  tips="Manos en un banco o silla firme. Baja contando 3 s hasta donde no haya molestia y sube a ritmo normal. Deja 3 o más repeticiones en reserva.",
                  easier="Superficie más alta (mesón).", harder="Superficie más baja, solo si no hay molestia.",
                  safety="Si el pliegue del codo molesta abajo, acorta el rango.")
X["row"] = ex("Remo australiano prono", img="inverted_row", muscles="Espalda media, romboides, deltoide posterior", load=False,
              tips="Agarre prono o neutro. Sube en 2 s, pausa breve con el pecho cerca de la barra y baja en 3 s.",
              easier="Cuerpo más vertical.", harder="Cuerpo más horizontal.",
              safety="Nada de agarre supino durante la recuperación.")
X["hang"] = ex("Cuelgue pasivo suave", typ="time", img="scap_pull", muscles="Hombros, antebrazos, descompresión",
               tips="Cuélgate relajado con los brazos completamente estirados. Si molesta, deja los pies apoyados en una silla para descargar parte del peso.",
               easier="Más peso sobre los pies.", harder="Sin apoyo de los pies.",
               safety="No dobles los codos durante el cuelgue.")
X["band_pull"] = ex("Dominada asistida con banda", img="band_pullup", muscles="Dorsal ancho, bíceps",
                    tips="Agarre prono y banda gruesa bajo las rodillas. Sube controlado y baja en 3 s. Alternativa: solo negativas de 5 s, subiendo con ayuda de una silla.",
                    easier="Banda más gruesa o solo negativas.", harder="Banda más delgada.",
                    safety="Prohibido el agarre supino, el impulso y los trucos. Deja 2–3 repeticiones en reserva.")
X["floor_push"] = ex("Flexiones estrictas en suelo", img="pushup", muscles="Pecho, tríceps, hombro",
                     tips="Cuerpo en tabla y codos a unos 45°. Baja hasta un rango sin molestia. Termina cada serie con 2–3 repeticiones en reserva.",
                     easier="Manos en un banco.", harder="Más repeticiones; nada de déficit ni explosivas todavía.",
                     safety="Sin llegar al fallo.")
X["pullups"] = ex("Dominadas pronas", img="pullups", muscles="Dorsal ancho, bíceps, espalda media", load=True,
                  tips="Estrictas, desde colgado completo y sin balanceo. Termina cada serie con 2–3 repeticiones en reserva.",
                  easier="Banda delgada o negativas lentas.", harder="Aún no: el peso extra vuelve en la rutina normal.",
                  safety="RIR 2–3. Si el codo molesta, vuelve a las dominadas con banda.")
X["dips_band"] = ex("Fondos asistidos con banda", img="dips", muscles="Pecho inferior, tríceps",
                    tips="Banda entre las paralelas bajo las rodillas. Baja solo hasta que el codo llegue a 90°.",
                    easier="Banda más gruesa.", harder="Banda más delgada; los fondos libres vuelven en la rutina normal.",
                    safety="RIR 3: lejos del fallo.")
X["decline"] = ex("Flexiones con pies en silla", img="decline_pushup", muscles="Hombro anterior, pecho superior, tríceps",
                  tips="Pies en una silla y cuerpo recto. Termina con 2–3 repeticiones en reserva.",
                  easier="Pies en el suelo.", harder="Silla más alta.")
X["facepull"] = ex("Face pull con banda", img="facepull", muscles="Deltoide posterior, manguito rotador",
                   tips="Banda suave anclada a la barra o paralela. Tira hacia la frente con los codos altos y rota los brazos hacia afuera al final.",
                   easier="Banda más suave.", harder="Banda más dura.")
X["kneeraise"] = ex("Elevación de rodillas colgado", img="hanging_raise", muscles="Abdomen, flexores de cadera",
                    tips="Colgado con brazos estirados, sube las rodillas al pecho sin balanceo y baja lento.",
                    easier="Acostado en el suelo.", harder="Piernas rectas (en la rutina normal).")
X["hipthrust"] = ex("Hip thrust a una pierna con mochila", img="hip_thrust", muscles="Glúteos, isquiotibiales", perLeg=True, load=True,
                    tips="Espalda alta en el sofá o banco, mochila sobre la cadera. Pausa de 2 s arriba. La foto muestra la versión con barra.",
                    easier="Con las dos piernas.", harder="Más peso o pausa de 3 s.")
X["tucklsit"] = ex("Tuck L-sit en paralelas", typ="time", img="tuck_lsit", muscles="Core, flexores de cadera, tríceps",
                   tips="Brazos rectos en las paralelas, empújalas hacia abajo y sube las rodillas.",
                   easier="Una pierna estirada a la vez.", harder="L-sit completo.")


def it(key, sets, lo, hi, rest, **over):
    d = copy.deepcopy(X[key])
    d.update(over)
    d.update(sets=sets, range=[lo, hi], rest=rest)
    return d


def block(label, *items):
    return dict(label=label, items=list(items))


DOW = {"Lun": 1, "Mar": 2, "Mié": 3, "Jue": 4, "Vie": 5, "Sáb": 6, "Dom": 0}


def session(code, name, days, upper, focus, *blocks):
    return dict(code=code, name=name, weekdays=[DOW[d] for d in days], upper=upper, focus=focus, blocks=list(blocks))


def legs2(code, name="Piernas y core", nordic=False):
    third = it("nordic", 3, 3, 5, 45) if nordic else it("slider", 3, 6, 10, 45)
    return session(code, name, ["Mié"], False, "Step-up, sentadilla a una pierna, isquios y core",
                   block("Superserie 1", it("stepup", 4, 8, 12, 60), it("legraise", 4, 10, 15, 60)),
                   block("Superserie 2", it("pistol", 3, 6, 10, 60), it("revcrunch", 3, 10, 15, 60)),
                   block("Superserie 3", third, it("hollow", 3, 20, 40, 45)),
                   block("Pantorrillas", it("calf", 3, 12, 20, 45)))


ROW45 = "Cuerpo a unos 45°, agarre prono o neutro. Sube en 2 s, pausa breve y baja en 3 s."
ROW30 = "Cuerpo entre 30° y 45°, agarre prono o neutro. Sube en 2 s, pausa breve y baja en 3 s."

PHASES = [
    dict(code="F0", name="Fase 0 · Descarga", days=4, gap=0, elbow=True,
         desc="Cero empuje y tracción de tren superior. Solo piernas, core sin apoyo en manos ni codos y movilidad sin carga.",
         criteria="Molestia en el codo de 0–1/10 en reposo y al estirar el brazo.",
         sessions=[
             session("F0-1", "Piernas y core 1", ["Lun", "Vie"], False, "Búlgara, peso muerto a una pierna y core",
                     block("Superserie 1", it("bulg", 4, 8, 12, 60), it("deadbug", 4, 8, 12, 60)),
                     block("Superserie 2", it("slrdl", 3, 8, 12, 60), it("hollow", 3, 20, 40, 60)),
                     block("Superserie 3", it("slbridge", 3, 10, 15, 45), it("wallsit", 3, 35, 45, 45)),
                     block("Pantorrillas", it("calf", 3, 12, 20, 45))),
             legs2("F0-2", "Piernas y core 2"),
         ]),
    dict(code="F1", name="Fase 1 · Isométricos suaves (25%)", days=4, gap=72, elbow=True,
         desc="Solo isométricos suaves de tren superior, con el codo a medio recorrido. Cero cuelgues ni dominadas. Tren superior máximo 2 veces por semana, con 72 h entre sesiones.",
         criteria="Isométricos con molestia de 2/10 o menos, y el codo igual o mejor al día siguiente.",
         sessions=[
             session("F1-S", "Isométricos + piernas", ["Lun", "Vie"], True, "Isométricos de empuje y tracción, piernas",
                     block("Superserie 1", it("iso_wall", 4, 20, 30, 60), it("bulg", 4, 8, 12, 60)),
                     block("Superserie 2", it("iso_row", 4, 20, 30, 60), it("slrdl", 4, 8, 12, 60)),
                     block("Superserie 3", it("slbridge", 3, 10, 15, 45), it("deadbug", 3, 8, 12, 45)),
                     block("Pantorrillas", it("calf", 3, 12, 20, 45))),
             legs2("F1-P"),
         ]),
    dict(code="F2", name="Fase 2 · Excéntricos controlados (45%)", days=7, gap=72, elbow=True,
         desc="Lagartijas inclinadas con bajada de 3 s, remo australiano a 45° y cuelgues pasivos. Sin dominadas ni fondos. Tren superior máximo 2 veces por semana, con 72 h entre sesiones.",
         criteria="Molestia de 2/10 o menos durante las 2 sesiones de tren superior, y el codo igual o mejor al día siguiente.",
         sessions=[
             session("F2-S", "Tren superior + piernas", ["Lun", "Vie"], True, "Excéntricos de empuje, remo a 45°, cuelgue y piernas",
                     block("Superserie 1", it("inc_ecc", 3, 8, 10, 75), it("bulg", 3, 8, 12, 60)),
                     block("Superserie 2", it("row", 3, 8, 10, 75, tips=ROW45, harder="Más horizontal, recién en la Fase 3."), it("slrdl", 3, 8, 12, 60)),
                     block("Superserie 3", it("hang", 3, 15, 20, 45), it("deadbug", 3, 8, 12, 45)),
                     block("Pantorrillas", it("calf", 3, 12, 20, 45))),
             legs2("F2-P"),
         ]),
    dict(code="F3", name="Fase 3 · Carga progresiva (70%)", days=7, gap=72, elbow=True,
         desc="Flexiones en suelo sin llegar al fallo y dominadas asistidas con banda o negativas lentas, 3×4–5. Nada explosivo ni trucos. Tren superior máximo 2 veces por semana, con 72 h entre sesiones.",
         criteria="Molestia de 2/10 o menos en flexiones y dominadas asistidas, y el codo igual o mejor al día siguiente.",
         sessions=[
             session("F3-S", "Tren superior + piernas", ["Lun", "Vie"], True, "Dominada asistida, flexiones, remo y piernas",
                     block("Superserie 1", it("band_pull", 3, 4, 5, 90), it("bulg", 3, 8, 12, 60)),
                     block("Superserie 2", it("floor_push", 3, 6, 10, 75), it("slrdl", 3, 8, 12, 60)),
                     block("Superserie 3", it("row", 3, 8, 10, 60, tips=ROW30), it("hollow", 3, 20, 40, 45)),
                     block("Cuelgue", it("hang", 2, 20, 30, 45))),
             legs2("F3-P", nordic=True),
         ]),
    dict(code="F4", name="Fase 4 · Retorno (90%)", days=7, gap=0, elbow=True,
         desc="Vuelven las dominadas libres estrictas con 2–3 repeticiones en reserva y los fondos asistidos. Todavía sin chin-ups, curl de bíceps ni bloque 3/7. Trucos dinámicos solo al final de la semana y solo con 0 molestia.",
         criteria="Toda la semana con 0–1/10 de molestia, y el codo igual o mejor al día siguiente.",
         sessions=[
             session("F4-A", "Día A · retorno", ["Lun"], True, "Dominadas estrictas, fondos con banda, búlgara y nórdico",
                     block("Superserie 1", it("pullups", 3, 4, 6, 90), it("dips_band", 3, 6, 8, 90)),
                     block("Superserie 2", it("bulg", 3, 8, 12, 60), it("decline", 3, 6, 10, 60)),
                     block("Superserie 3", it("nordic", 3, 3, 6, 45), it("kneeraise", 3, 8, 12, 45))),
             session("F4-B", "Día B · retorno", ["Mié"], True, "Remo, flexiones, step-up y peso muerto a una pierna",
                     block("Superserie 1", it("row", 3, 8, 12, 70), it("floor_push", 3, 8, 12, 70)),
                     block("Superserie 2", it("stepup", 3, 8, 12, 60), it("facepull", 3, 12, 15, 60)),
                     block("Superserie 3", it("slrdl", 3, 8, 12, 45), it("deadbug", 3, 8, 12, 45))),
             session("F4-C", "Día C · retorno", ["Vie"], True, "Dominadas estrictas, fondos con banda, sentadilla a una pierna y hip thrust",
                     block("Superserie 1", it("pullups", 3, 4, 6, 90), it("dips_band", 3, 6, 8, 90)),
                     block("Superserie 2", it("pistol", 3, 6, 10, 60), it("row", 3, 8, 12, 60)),
                     block("Superserie 3", it("hipthrust", 3, 10, 15, 45), it("tucklsit", 3, 15, 25, 45))),
         ]),
]


# Rutina normal (la de antes), tomada de la versión anterior de la app
def legacy_item(key, sets, rest):
    e = LEGACY["EXERCISES"][key]
    d = dict(name=e["name"], type=e["type"], img=e.get("img"), muscles=e.get("muscles", ""), tips=e.get("tips", ""),
             easier=e.get("easier", ""), harder=e.get("harder", ""), safety=e.get("safety", ""),
             perLeg=bool(e.get("perLeg")), load=bool(e.get("load")), sets=sets, range=list(e["range"]), rest=rest)
    if key in ("chinup", "band_curl", "inverted_row_sup"):
        d["safety"] = ((d["safety"] + " ") if d["safety"] else "") + \
            "Tras la tendinopatía: si el pliegue del codo molesta, cambia a agarre prono y avísale a Claude."
    return d


def legacy_session(code, weekday):
    day = LEGACY["DAYS"][code]
    blocks = []
    for b in day["blocks"]:
        if b["type"] == "ss":
            blocks.append(block(b["label"], *[legacy_item(k, b["rounds"], b["rest"]) for k in b["items"]]))
        else:
            d = legacy_item(b["item"], 1, 60)
            d.update(type="37", range=[3, 7])
            blocks.append(block(b["label"], d))
    return dict(code="N-" + code, name=day["title"], weekdays=[weekday], upper=True, focus=day["focus"], blocks=blocks)


PHASES.append(dict(code="N", name="Rutina normal · Calistenia 45", days=0, gap=0, elbow=False,
                   desc="La rutina completa A/B/C en superseries, con bloque final 3/7. Semana de descarga cada 21 sesiones.",
                   criteria="",
                   sessions=[legacy_session("A", 1), legacy_session("B", 3), legacy_session("C", 5)]))

ALL = ["F0", "F1", "F2", "F3", "F4", "N"]
WARM = [  # (fases, nombre, segundos, foto)
    (ALL, "Trote suave en el lugar", 60, None),
    (ALL, "Sentadillas al aire lentas", 60, "air_squat"),
    (ALL, "Círculos de brazos (10 adelante, 10 atrás)", 30, "arm_circles"),
    (["F0", "F1", "F2", "F3", "F4"], "Rotación de hombros con las manos en los hombros × 10", 30, "elbow_circles"),
    (ALL, "Círculos de muñeca", 30, "wrist_circles"),
    (["F0", "F1", "F2", "F3", "F4"], "Codo sin carga: doblar y estirar suave × 10, sin dolor", 30, None),
    (["F0", "F1", "F2", "F3", "F4"], "Antebrazo sin carga: girar palmas arriba y abajo × 10", 30, None),
    (["F2", "F3", "F4", "N"], "Dislocaciones de hombro con banda suave × 10", 30, None),
    (["F2", "F3", "F4", "N"], "Band pull-aparts con banda suave × 10 (codos rectos)", 30, "pull_apart"),
    (["F3", "F4", "N"], "Colgado relajado 20–30 s", 30, "scap_pull"),
    (ALL, "Balanceos de pierna adelante-atrás y laterales × 10 por lado", 60, None),
    (["F0", "F1"], "Zancada con rotación de tronco, manos en la rodilla × 5 por lado", 30, "hip_flexor"),
    (["F2", "F3", "F4", "N"], "World's greatest stretch × 5 por lado", 30, "hip_flexor"),
    (ALL, "Puentes de glúteo con pausa × 10", 30, "glute_bridge"),
    (["F0", "F1"], "Rotación torácica de pie × 8 por lado", 30, None),
    (["F2", "F3", "F4", "N"], "Gato-camello × 8", 30, "cat"),
]
COOL = [
    (ALL, "Flexor de cadera en zancada, 30 s por lado", "hip_flexor"),
    (ALL, "Pecho en marco de puerta, 30 s", None),
    (["F0", "F1", "F2", "F3", "F4"], "Bíceps suave: brazo estirado atrás con la mano en la pared, 30 s, sin dolor", None),
    (["F3", "F4", "N"], "Dorsal colgado de la barra, 30 s", "scap_pull"),
]

PROGRAM_NAME = "Recuperación de codo + Calistenia 45"


# ---------------------------------------------------------------- normalizar (mismo resultado que el lector de la app)
def normalize():
    phases = []
    for p in PHASES:
        sess = []
        for s in p["sessions"]:
            blocks = []
            for b in s["blocks"]:
                items = []
                for d in b["items"]:
                    items.append(dict(id=slug(d["name"]), name=d["name"], type=d["type"],
                                      sets=1 if d["type"] == "37" else d["sets"],
                                      range=[3, 7] if d["type"] == "37" else d["range"],
                                      perLeg=d["perLeg"], rest=d["rest"], load=d["load"], img=d["img"] or None,
                                      muscles=d["muscles"], tips=d["tips"], easier=d["easier"],
                                      harder=d["harder"], safety=d["safety"]))
                typ = "37" if any(i["type"] == "37" for i in items) else ("ss" if len(items) > 1 else "single")
                blocks.append(dict(label=b["label"], type=typ, rounds=max(i["sets"] for i in items), items=items))
            sess.append(dict(code=s["code"], name=s["name"], weekdays=s["weekdays"], upper=s["upper"],
                             focus=s["focus"], blocks=blocks))
        phases.append(dict(code=p["code"], name=p["name"], days=p["days"], gap=p["gap"], elbow=p["elbow"],
                           desc=p["desc"], criteria=p["criteria"], sessions=sess,
                           warmup=[dict(name=n, dur=sec, img=img) for f, n, sec, img in WARM if p["code"] in f],
                           cooldown=[dict(name=n, img=img) for f, n, img in COOL if p["code"] in f]))
    return dict(name=PROGRAM_NAME, phases=phases)


# ---------------------------------------------------------------- Excel
HEAD_FILL = PatternFill("solid", fgColor="1F2A3A")
HEAD_FONT = Font(bold=True, color="FFFFFF")
WRAP = Alignment(wrap_text=True, vertical="top")
INV = {v: k for k, v in DOW.items()}


def sheet(wb, title, headers, rows, widths):
    ws = wb.create_sheet(title)
    ws.append(headers)
    for c in ws[1]:
        c.fill, c.font, c.alignment = HEAD_FILL, HEAD_FONT, Alignment(vertical="center", wrap_text=True)
    for r in rows:
        ws.append(r)
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = WRAP
    ws.freeze_panes = "A2"
    return ws


def yn(b):
    return "sí" if b else "no"


def write_xlsx(path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Leeme"
    lines = [
        ("Rutina para la app Calistenia 45", True),
        ("", False),
        ("Cómo cargarla: en la app ve a Ajustes → Cargar rutina desde Excel y elige este archivo.", False),
        ("Puedes editar cualquier hoja. Respeta los nombres de las hojas y de las columnas (la fila 1).", False),
        ("", False),
        ("Hoja Programa: el nombre de la rutina.", False),
        ("Hoja Fases: una fila por fase, en el orden en que se hacen. Días = duración mínima (0 = sin fin). "
         "Horas tren superior = horas mínimas entre sesiones de tren superior (0 = sin límite). "
         "Control de codo = sí para que la app pregunte por la molestia antes y después de entrenar.", False),
        ("Hoja Sesiones: los entrenamientos de cada fase. Días de la semana sugeridos: Lun, Mar, Mié, Jue, Vie, Sáb, Dom.", False),
        ("Hoja Ejercicios: una fila por ejercicio. Las filas seguidas con la misma Fase, Sesión y Bloque forman una superserie "
         "(se alternan ronda a ronda). Un bloque con un solo ejercicio son series normales.", False),
        ("   Tipo: reps, tiempo (segundos) o 3-7 (bloque final de 3-4-5-6-7 repeticiones con 15 s de pausa).", False),
        ("   Descanso (s): descanso después de ese ejercicio. Mochila = sí para anotar el peso. Foto: una clave de la hoja Fotos (o vacío).", False),
        ("Hoja Calentamiento: Momento = Calentamiento o Vuelta a la calma. Fases = códigos separados por coma (vacío = todas).", False),
        ("", False),
        ("Tu registro no se borra al cargar una rutina nueva: el historial de cada ejercicio se guarda por su nombre.", False),
    ]
    for t, b in lines:
        ws.append([t])
        ws.cell(ws.max_row, 1).font = Font(bold=b, size=14 if b else 11)
        ws.cell(ws.max_row, 1).alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 120

    sheet(wb, "Programa", ["Campo", "Valor"], [["Nombre", PROGRAM_NAME]], [16, 60])

    sheet(wb, "Fases", ["Fase", "Nombre", "Días", "Horas tren superior", "Control de codo", "Descripción", "Criterio para avanzar"],
          [[p["code"], p["name"], p["days"], p["gap"], yn(p["elbow"]), p["desc"], p["criteria"]] for p in PHASES],
          [8, 34, 8, 12, 10, 60, 50])

    rows = []
    for p in PHASES:
        for s in p["sessions"]:
            rows.append([p["code"], s["code"], s["name"], ", ".join(INV[d] for d in s["weekdays"]), yn(s["upper"]), s["focus"]])
    sheet(wb, "Sesiones", ["Fase", "Sesión", "Nombre", "Días de la semana", "Tren superior", "Enfoque"], rows, [8, 10, 26, 16, 12, 60])

    rows = []
    for p in PHASES:
        for s in p["sessions"]:
            for b in s["blocks"]:
                for d in b["items"]:
                    is37 = d["type"] == "37"
                    rows.append([p["code"], s["code"], b["label"], d["name"],
                                 "3-7" if is37 else d["type"],
                                 None if is37 else d["sets"], None if is37 else d["range"][0], None if is37 else d["range"][1],
                                 yn(d["perLeg"]), d["rest"], yn(d["load"]), d["img"] or "",
                                 d["muscles"], d["tips"], d["easier"], d["harder"], d["safety"]])
    wsx = sheet(wb, "Ejercicios",
                ["Fase", "Sesión", "Bloque", "Ejercicio", "Tipo", "Series", "Mín", "Máx", "Por lado", "Descanso (s)",
                 "Mochila", "Foto", "Músculos", "Técnica", "Más fácil", "Más difícil", "Precaución"],
                rows, [7, 9, 14, 34, 8, 7, 6, 6, 8, 10, 8, 14, 26, 60, 34, 34, 40])
    n = len(rows) + 200
    for col, opts in (("E", '"reps,tiempo,3-7"'), ("I", '"sí,no"'), ("K", '"sí,no"')):
        dv = DataValidation(type="list", formula1=opts, allow_blank=True)
        wsx.add_data_validation(dv)
        dv.add(f"{col}2:{col}{n}")
    dv = DataValidation(type="list", formula1=f"Fotos!$A$2:$A${len(PHOTOS) + 1}", allow_blank=True)
    wsx.add_data_validation(dv)
    dv.add(f"L2:L{n}")

    rows = [["Calentamiento", ", ".join(f) if f != ALL else "", nme, sec, img or ""] for f, nme, sec, img in WARM]
    rows += [["Vuelta a la calma", ", ".join(f) if f != ALL else "", nme, None, img or ""] for f, nme, img in COOL]
    sheet(wb, "Calentamiento", ["Momento", "Fases", "Ejercicio", "Duración (s)", "Foto"], rows, [18, 22, 70, 12, 16])

    sheet(wb, "Fotos", ["Clave", "Qué muestra"], [[k, v] for k, v in PHOTOS.items()], [18, 44])
    wb.save(path)


if __name__ == "__main__":
    prog = normalize()
    with open(os.path.join(ROOT, "www", "default-program.js"), "w", encoding="utf-8") as f:
        f.write("// Rutina incluida en la app. Generada con tools/build_program.py\n")
        f.write("window.DEFAULT_PROGRAM = " + json.dumps(prog, ensure_ascii=False, indent=1) + ";\n")
        f.write("window.PHOTO_KEYS = " + json.dumps(sorted(PHOTOS), ensure_ascii=False) + ";\n")
    with open(os.path.join(ROOT, "tools", "default-program.json"), "w", encoding="utf-8") as f:
        json.dump(prog, f, ensure_ascii=False, indent=1)
    if len(sys.argv) > 1:
        write_xlsx(sys.argv[1])
    print("fases", len(prog["phases"]), "sesiones", sum(len(p["sessions"]) for p in prog["phases"]))
