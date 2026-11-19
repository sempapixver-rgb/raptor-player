#!/usr/bin/env python3
"""Gera Raptor.xcodeproj/project.pbxproj a partir dos arquivos em Raptor/.

Rode novamente se adicionar/remover arquivos .swift:
    python3 ios/generate_project.py
"""
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "Raptor"
PROJ = ROOT / "Raptor.xcodeproj"
PBX = PROJ / "project.pbxproj"


def uid(key: str) -> str:
    return hashlib.sha1(key.encode()).hexdigest()[:24].upper()


def quote(value: str) -> str:
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


swift_files = sorted(APP.rglob("*.swift"))
if not swift_files:
    raise SystemExit("Nenhum arquivo .swift encontrado em ios/Raptor")

rel_swift = [p.relative_to(APP).as_posix() for p in swift_files]

lines: list[str] = []
w = lines.append

w("// !$*UTF8*$!")
w("{")
w("\tarchiveVersion = 1;")
w("\tclasses = {")
w("\t};")
w("\tobjectVersion = 56;")
w("\tobjects = {")

# ---------------- file references ----------------
w("/* Begin PBXBuildFile section */")
for rel in rel_swift:
    fid = uid("file:" + rel)
    bid = uid("build:swift:" + rel)
    w(f"\t\t{bid} /* {Path(rel).name} in Sources */ = {{isa = PBXBuildFile; fileRef = {fid} /* {Path(rel).name} */; }};")
aid = uid("file:Assets.xcassets")
w(f"\t\t{uid('build:assets')} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {aid} /* Assets.xcassets */; }};")
pid = uid("file:Info.plist")
w("\t/* End PBXBuildFile section */")

w("/* Begin PBXFileReference section */")
for rel in rel_swift:
    fid = uid("file:" + rel)
    name = Path(rel).name
    w(f"\t\t{fid} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {quote(name)}; sourceTree = \"<group>\"; }};")
w(f"\t\t{aid} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = \"<group>\"; }};")
w(f"\t\t{pid} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = \"<group>\"; }};")
w(f"\t\t{uid('file:Raptor.entitlements')} /* Raptor.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = Raptor.entitlements; sourceTree = \"<group>\"; }};")
app_ref = uid("file:Raptor.app")
w(f"\t\t{app_ref} /* Raptor.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Raptor.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
w("\t/* End PBXFileReference section */")

w("/* Begin PBXFrameworksBuildPhase section */")
w(f"\t\t{uid('phase:frameworks')} /* Frameworks */ = {{")
w("\t\t\tisa = PBXFrameworksBuildPhase;")
w("\t\t\tbuildActionMask = 2147483647;")
w("\t\t\tfiles = (")
w("\t\t\t);")
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
w("\t\t};")
w("\t/* End PBXFrameworksBuildPhase section */")

w("/* Begin PBXGroup section */")
subdirs = sorted({"/".join(Path(r).parts[:-1]) for r in rel_swift if len(Path(r).parts) > 1})
root_group = uid("group:root")
w(f"\t\t{root_group} = {{")
w("\t\t\tisa = PBXGroup;")
w("\t\t\tchildren = (")
w(f"\t\t\t\t{uid('group:app')} /* Raptor */,")
w(f"\t\t\t\t{uid('group:products')} /* Products */,")
w("\t\t\t);")
w("\t\t\tsourceTree = \"<group>\";")
w("\t\t};")
w(f"\t\t{uid('group:products')} /* Products */ = {{")
w("\t\t\tisa = PBXGroup;")
w("\t\t\tchildren = (")
w(f"\t\t\t\t{app_ref} /* Raptor.app */,")
w("\t\t\t);")
w("\t\t\tname = Products;")
w("\t\t\tsourceTree = \"<group>\";")
w("\t\t};")
w(f"\t\t{uid('group:app')} /* Raptor */ = {{")
w("\t\t\tisa = PBXGroup;")
w("\t\t\tchildren = (")
for rel in rel_swift:
    parts = Path(rel).parts
    group_key = "group:app:" + "/".join(parts[:-1]) if len(parts) > 1 else "group:app"
    # arquivos em subpastas são incluídos via grupos criados abaixo
    if len(parts) == 1:
        w(f"\t\t\t\t{uid('file:' + rel)} /* {parts[-1]} */,")
for sub in subdirs:
    w(f"\t\t\t\t{uid('group:app:' + sub)} /* {Path(sub).name} */,")
w(f"\t\t\t\t{aid} /* Assets.xcassets */,")
w(f"\t\t\t\t{pid} /* Info.plist */,")
w(f"\t\t\t\t{uid('file:Raptor.entitlements')} /* Raptor.entitlements */,")
w("\t\t\t);")
w("\t\t\tpath = Raptor;")
w("\t\t\tsourceTree = \"<group>\";")
w("\t\t};")

for sub in subdirs:
    gkey = "group:app:" + sub
    w(f"\t\t{uid(gkey)} /* {Path(sub).name} */ = {{")
    w("\t\t\tisa = PBXGroup;")
    w("\t\t\tchildren = (")
    for rel in rel_swift:
        if "/".join(Path(rel).parts[:-1]) == sub:
            w(f"\t\t\t\t{uid('file:' + rel)} /* {Path(rel).name} */,")
    w("\t\t\t);")
    w(f"\t\t\tpath = {quote(Path(sub).name)};")
    w("\t\t\tsourceTree = \"<group>\";")
    w("\t\t};")
# adiciona subgrupos ao grupo Raptor
w("/* subgrupos (adicionados ao children do grupo Raptor acima) */")
w("\t/* End PBXGroup section */")

w("/* Begin PBXNativeTarget section */")
target = uid("target:Raptor")
w(f"\t\t{target} /* Raptor */ = {{")
w("\t\t\tisa = PBXNativeTarget;")
w(f"\t\t\tbuildConfigurationList = {uid('configlist:target')} /* Build configuration list for PBXNativeTarget \"Raptor\" */;")
w("\t\t\tbuildPhases = (")
w(f"\t\t\t\t{uid('phase:sources')} /* Sources */,")
w(f"\t\t\t\t{uid('phase:frameworks')} /* Frameworks */,")
w(f"\t\t\t\t{uid('phase:resources')} /* Resources */,")
w("\t\t\t);")
w("\t\t\tbuildRules = (")
w("\t\t\t);")
w("\t\t\tdependencies = (")
w("\t\t\t);")
w("\t\t\tname = Raptor;")
w("\t\t\tproductName = Raptor;")
w(f"\t\t\tproductReference = {app_ref} /* Raptor.app */;")
w("\t\t\tproductType = \"com.apple.product-type.application\";")
w("\t\t};")
w("\t/* End PBXNativeTarget section */")

w("/* Begin PBXProject section */")
project = uid("project")
w(f"\t\t{project} /* Project object */ = {{")
w("\t\t\tisa = PBXProject;")
w("\t\t\tattributes = {")
w("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
w("\t\t\t\tLastUpgradeCheck = 1600;")
w("\t\t\t\tTargetAttributes = {")
w(f"\t\t\t\t\t{target} = {{")
w("\t\t\t\t\t\tCreatedOnToolsVersion = 16.0;")
w("\t\t\t\t\t};")
w("\t\t\t\t};")
w("\t\t\t};")
w(f"\t\t\tbuildConfigurationList = {uid('configlist:project')} /* Build configuration list for PBXProject \"Raptor\" */;")
w("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
w("\t\t\tdevelopmentRegion = en;")
w("\t\t\tknownRegions = (")
w("\t\t\t\ten,")
w("\t\t\t\tBase,")
w("\t\t\t\tpt-BR,")
w("\t\t\t);")
w(f"\t\t\tmainGroup = {root_group};")
w("\t\t\tproductRefGroup = " + uid("group:products") + " /* Products */;")
w("\t\t\tprojectDirPath = \"\";")
w("\t\t\tprojectRoot = \"\";")
w("\t\t\ttargets = (")
w(f"\t\t\t\t{target} /* Raptor */,")
w("\t\t\t);")
w("\t\t};")
w("\t/* End PBXProject section */")

w("/* Begin PBXSourcesBuildPhase section */")
w(f"\t\t{uid('phase:sources')} /* Sources */ = {{")
w("\t\t\tisa = PBXSourcesBuildPhase;")
w("\t\t\tbuildActionMask = 2147483647;")
w("\t\t\tfiles = (")
for rel in rel_swift:
    w(f"\t\t\t\t{uid('build:swift:' + rel)} /* {Path(rel).name} in Sources */,")
w("\t\t\t);")
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
w("\t\t};")
w("\t/* End PBXSourcesBuildPhase section */")

w("/* Begin PBXResourcesBuildPhase section */")
w(f"\t\t{uid('phase:resources')} /* Resources */ = {{")
w("\t\t\tisa = PBXResourcesBuildPhase;")
w("\t\t\tbuildActionMask = 2147483647;")
w("\t\t\tfiles = (")
w(f"\t\t\t\t{uid('build:assets')} /* Assets.xcassets in Resources */,")
w("\t\t\t);")
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
w("\t\t};")
w("\t/* End PBXResourcesBuildPhase section */")

common = [
    ("IPHONEOS_DEPLOYMENT_TARGET", "16.0"),
    ("SWIFT_VERSION", "5.0"),
    ("SDKROOT", "iphoneos"),
    ("CLANG_ENABLE_MODULES", "YES"),
    ("CLANG_ENABLE_OBJC_ARC", "YES"),
    ("ENABLE_STRICT_OBJC_MSGSEND", "YES"),
    ("GCC_C_LANGUAGE_STANDARD", "gnu17"),
    ("GCC_NO_COMMON_BLOCKS", "YES"),
    ("MTL_ENABLE_DEBUG_INFO", "YES"),
    ("ALWAYS_SEARCH_USER_PATHS", "NO"),
    ("CLANG_ANALYZER_NONNULL", "YES"),
    ("CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION", "YES_AGGRESSIVE"),
    ("CLANG_WARN_DOCUMENTATION_COMMENTS", "YES"),
    ("CLANG_WARN_EMPTY_BODY", "YES"),
    ("CLANG_WARN_UNGUARDED_AVAILABILITY", "YES_AGGRESSIVE"),
    ("GCC_WARN_ABOUT_RETURN_TYPE", "YES_ERROR"),
    ("GCC_WARN_UNINITIALIZED_AUTOS", "YES_AGGRESSIVE"),
    ("GCC_WARN_UNUSED_FUNCTION", "YES"),
    ("GCC_WARN_UNUSED_VARIABLE", "YES"),
]

w("/* Begin XCBuildConfiguration section */")
for cfg in ("Debug", "Release"):
    cid = uid(f"config:project:{cfg}")
    w(f"\t\t{cid} /* {cfg} */ = {{")
    w("\t\t\tisa = XCBuildConfiguration;")
    w("\t\t\tbuildSettings = {")
    for k, v in common:
        w(f"\t\t\t\t{k} = {v};")
    w("\t\t\t\tGCC_OPTIMIZATION_LEVEL = " + ("0" if cfg == "Debug" else "s") + ";")
    w("\t\t\t\tDEBUG_INFORMATION_FORMAT = " + ("dwarf" if cfg == "Debug" else "dwarf-with-dsym") + ";")
    w("\t\t\t\tENABLE_TESTABILITY = " + ("YES" if cfg == "Debug" else "NO") + ";")
    w("\t\t\t\tONLY_ACTIVE_ARCH = " + ("YES" if cfg == "Debug" else "NO") + ";")
    w("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = " + ("-Onone" if cfg == "Debug" else "-O") + ";")
    w("\t\t\t};")
    w(f"\t\t\tname = {cfg};")
    w("\t\t};")

for cfg in ("Debug", "Release"):
    cid = uid(f"config:target:{cfg}")
    w(f"\t\t{cid} /* {cfg} */ = {{")
    w("\t\t\tisa = XCBuildConfiguration;")
    w("\t\t\tbuildSettings = {")
    w("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    w("\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;")
    w("\t\t\t\tCODE_SIGN_ENTITLEMENTS = Raptor/Raptor.entitlements;")
    w("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    w("\t\t\t\tCURRENT_PROJECT_VERSION = 1;")
    w("\t\t\t\tDEVELOPMENT_TEAM = \"\";")
    w("\t\t\t\tENABLE_PREVIEWS = YES;")
    w("\t\t\t\tGENERATE_INFOPLIST_FILE = NO;")
    w("\t\t\t\tINFOPLIST_FILE = Raptor/Info.plist;")
    w("\t\t\t\tINFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;")
    w("\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;")
    w("\t\t\t\tMARKETING_VERSION = 1.0.0;")
    w("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.raptor.player.iphone;")
    w("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    w("\t\t\t\tSUPPORTED_PLATFORMS = \"iphoneos iphonesimulator\";")
    w("\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;")
    w("\t\t\t\tSWIFT_STRICT_CONCURRENCY = minimal;")
    w("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
    w("\t\t\t};")
    w(f"\t\t\tname = {cfg};")
    w("\t\t};")
w("\t/* End XCBuildConfiguration section */")

w("/* Begin XCConfigurationList section */")
w(f"\t\t{uid('configlist:project')} /* Build configuration list for PBXProject \"Raptor\" */ = {{")
w("\t\t\tisa = XCConfigurationList;")
w("\t\t\tbuildConfigurations = (")
w(f"\t\t\t\t{uid('config:project:Debug')} /* Debug */,")
w(f"\t\t\t\t{uid('config:project:Release')} /* Release */,")
w("\t\t\t);")
w("\t\t\tdefaultConfigurationIsVisible = 0;")
w("\t\t\tdefaultConfigurationName = Release;")
w("\t\t};")
w(f"\t\t{uid('configlist:target')} /* Build configuration list for PBXNativeTarget \"Raptor\" */ = {{")
w("\t\t\tisa = XCConfigurationList;")
w("\t\t\tbuildConfigurations = (")
w(f"\t\t\t\t{uid('config:target:Debug')} /* Debug */,")
w(f"\t\t\t\t{uid('config:target:Release')} /* Release */,")
w("\t\t\t);")
w("\t\t\tdefaultConfigurationIsVisible = 0;")
w("\t\t\tdefaultConfigurationName = Release;")
w("\t\t};")
w("\t/* End XCConfigurationList section */")

w("\t};")
w("\trootObject = " + project + " /* Project object */;")
w("}")

PROJ.mkdir(parents=True, exist_ok=True)
PBX.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"OK: {PBX} ({len(rel_swift)} arquivos Swift)")
