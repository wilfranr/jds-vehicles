#!/usr/bin/env bash
# Comprobaciones externas del proxy (F6-03), solo lectura salvo un POST de 56 MB que debe ser rechazado.
#   scripts/docker/proxy-check.sh <https://host[:puerto]> [on|off]     (segundo argumento: HSTS esperado, por defecto off)
# Usa `curl -k` (certificado interno). No imprime cookies ni cuerpos.
set -euo pipefail

BASE="${1:?uso: proxy-check.sh <https://host[:puerto]> [on|off]}"
HSTS_EXPECTED="${2:-off}"
FAILED=0
ok() { echo "  ok  $*"; }
bad() { echo "  FALLO  $*" >&2; FAILED=1; }
status() { curl -sk -o /dev/null -w '%{http_code}' "$@"; }

echo "== Rutas (esperado: 200 / 200 / 307 / 404 / 200)"
for pair in "/:200" "/login:200" "/admin:307" "/media/no-existe.webp:404" "/api/health:200"; do
  path="${pair%%:*}"; want="${pair##*:}"; got="$(status "${BASE}${path}")"
  [[ "$got" == "$want" ]] && ok "${path} -> ${got}" || bad "${path} -> ${got} (esperado ${want})"
done

echo "== Cabeceras"
HEADERS="$(curl -skI "${BASE}/")"
grep -qi '^content-security-policy:' <<<"$HEADERS" && ok "CSP presente" || bad "falta la CSP"
grep -i '^content-security-policy:' <<<"$HEADERS" | grep -qi "unsafe-eval" && bad "la CSP contiene unsafe-eval" || ok "la CSP no contiene unsafe-eval"
grep -qi '^x-powered-by:' <<<"$HEADERS" && bad "X-Powered-By presente" || ok "sin X-Powered-By"
if grep -qi '^strict-transport-security:' <<<"$HEADERS"; then
  [[ "$HSTS_EXPECTED" == "on" ]] && ok "HSTS presente (esperado: on)" || bad "HSTS presente pero se esperaba off"
else
  [[ "$HSTS_EXPECTED" == "off" ]] && ok "sin HSTS (esperado: off)" || bad "falta HSTS (se esperaba on)"
fi

echo "== Compresión"
for enc in zstd gzip; do
  curl -sk -o /dev/null -D - -H "Accept-Encoding: ${enc}" "${BASE}/catalogo" | grep -qi "^content-encoding: ${enc}" \
    && ok "content-encoding: ${enc}" || bad "sin compresión ${enc}"
done

echo "== Límites de cuerpo"
big="$(head -c $((56 * 1024 * 1024)) /dev/zero | curl -sk -o /dev/null -w '%{http_code}' -X POST --data-binary @- -H 'Content-Type: application/octet-stream' "${BASE}/admin/vehiculos/1/fotos" || true)"
[[ "$big" == "413" ]] && ok "56 MB a /admin/vehiculos/*/fotos -> 413" || bad "56 MB -> ${big} (esperado 413)"
two="$(head -c $((2 * 1024 * 1024)) /dev/zero | curl -sk -o /dev/null -w '%{http_code}' -X POST --data-binary @- -H 'Content-Type: application/octet-stream' "${BASE}/login" || true)"
[[ "$two" == "413" ]] && ok "2 MB a otra ruta -> 413" || bad "2 MB a /login -> ${two} (esperado 413)"

echo "== HTTP plano en el puerto HTTPS"
plain="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://${BASE#https://}/" || true)"
[[ "$plain" == "400" || "$plain" == "000" ]] && ok "HTTP plano rechazado (${plain})" || bad "HTTP plano -> ${plain}"

[[ "$FAILED" == "0" ]] && { echo "PROXY OK"; exit 0; } || { echo "PROXY CON FALLOS" >&2; exit 1; }
