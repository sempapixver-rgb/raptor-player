#!/usr/bin/env bash
# Gera o pacote .vpkg para enviar a Amazon Appstore.
#
# `npm run build:release` deixa build_number 0 no pacote. Isso instala por
# sideload, mas a Amazon rejeita o envio:
#
#   Error 1: build_number must be greater than 0, found: 0
#
# A versao e o build vem de src/config/app.ts, para nao divergirem do que o
# app mostra em Ajustes: BUILD_NUMBER "20261127.01" vira 2026112701.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_VERSION=$(sed -n "s/^export const APP_VERSION = '\(.*\)';$/\1/p" src/config/app.ts)
BUILD_MARKER=$(sed -n "s/^export const BUILD_NUMBER = '\(.*\)';$/\1/p" src/config/app.ts)

if [ -z "$APP_VERSION" ] || [ -z "$BUILD_MARKER" ]; then
    echo "Nao foi possivel ler APP_VERSION / BUILD_NUMBER de src/config/app.ts" >&2
    exit 1
fi

BUILD_DATE=${BUILD_MARKER%%.*}
BUILD_SEQ_RAW=${BUILD_MARKER##*.}
BUILD_SEQ=$((10#$BUILD_SEQ_RAW))
VEGA_BUILD_NUMBER=$(printf '%s%02d' "$BUILD_DATE" "$BUILD_SEQ")

echo "Gerando Raptor Player $APP_VERSION"
echo "  marcador do app:   $BUILD_MARKER"
echo "  build number Vega: $VEGA_BUILD_NUMBER"
echo

# Fire TV Stick 4K Select e armv7. x86_64 serve apenas para o emulador Vega.
TARGET=armv7
STAGE=build/$TARGET-release
PACKAGE=$STAGE/raptor_$TARGET.vpkg

rm -f "$PACKAGE"

npx react-native build-vega \
    --build-type Release --target "$TARGET" \
    --build-number "$VEGA_BUILD_NUMBER" \
    --build-version "$APP_VERSION"

# O SDK 2.x grava o pacote em build/private/kepler/<app>/... com o nome
# derivado do package.json (@raptor/player-vega -> player-vega). Localizar o
# artefato real em vez de assumir o caminho antigo usado pelo SDK 0.24.
GENERATED=$(find build -type f -name "*_$TARGET.vpkg" -print -quit)
if [ -z "$GENERATED" ]; then
    echo "O build terminou mas nao gerou o pacote .vpkg." >&2
    exit 1
fi

INFO_SRC=$(dirname "$GENERATED")/vpkg-info.json
if [ ! -f "$INFO_SRC" ]; then
    INFO_SRC=$(find build -type f -name 'vpkg-info.json' -print -quit)
fi
if [ -z "$INFO_SRC" ] || [ ! -f "$INFO_SRC" ]; then
    echo "O build gerou o .vpkg mas nao o vpkg-info.json." >&2
    exit 1
fi

mkdir -p "$STAGE"
cp "$GENERATED" "$PACKAGE"
cp "$INFO_SRC" "$STAGE/vpkg-info.json"

ACTUAL=$(sed -n 's/.*"build_number": \([0-9]*\).*/\1/p' "$STAGE/vpkg-info.json")
if [ "$ACTUAL" != "$VEGA_BUILD_NUMBER" ]; then
    echo "build_number do pacote e '$ACTUAL', esperado '$VEGA_BUILD_NUMBER'." >&2
    exit 1
fi

# Nenhuma biblioteca nativa de outra arquitetura pode entrar no pacote.
if tar -tf "$PACKAGE" | grep '^lib/' | grep -v "^lib/$TARGET/" | grep -q .; then
    echo "O pacote contem bibliotecas de outra arquitetura:" >&2
    tar -tf "$PACKAGE" | grep '^lib/' >&2
    exit 1
fi

echo
echo "Pacote gerado em: $GENERATED"
echo "Pacote para envio: $PACKAGE"
cat "$STAGE/vpkg-info.json"
