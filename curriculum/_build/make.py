# -*- coding: utf-8 -*-
import os, sys, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render
importlib.reload(render)

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs(OUT, exist_ok=True)

MODULES = ["c_elementary", "c_middle", "c_highschool", "c_advanced"]
ALL = []
for m in MODULES:
    try:
        mod = importlib.import_module(m)
        importlib.reload(mod)
        ALL.extend(mod.COURSES)
    except ModuleNotFoundError:
        print("skip (not written yet):", m)

only = sys.argv[1:] if len(sys.argv) > 1 else None
for c in ALL:
    if only and c["code"] not in only:
        continue
    p = render.build_course(c, OUT)
    print("%-10s %2d units  ->  %s" % (c["code"], len(c["units"]), os.path.basename(p)))
print("total courses:", len(ALL))
