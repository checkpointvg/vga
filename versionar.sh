#!/bin/sh
# Agrega ?v=<hash del contenido> a los .css/.js locales en los HTML, para que
# GitHub Pages (Cache-Control fijo de 10 min) no sirva versiones viejas.
# La versión de cada archivo solo cambia cuando cambia su contenido.
# Correr antes de cada commit:  sh versionar.sh
cd "$(dirname "$0")" || exit 1
for asset in styles.css config.js toasty.js; do
    [ -f "$asset" ] || continue
    v=$(git hash-object "$asset" | cut -c1-8)
    esc=$(printf '%s' "$asset" | sed 's/\./\\./g')
    for html in *.html; do
        sed -i -E "s#(src|href)=\"$esc(\?v=[0-9a-f]*)?\"#\1=\"$asset?v=$v\"#g" "$html"
    done
done
