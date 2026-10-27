# Radar Coche

Web estática para guardar y comparar anuncios de coches usados con tus propios límites. Funciona en el navegador sin cuenta, servidor de datos, IA local ni API de pago.

1. Abre la web y define **Mi búsqueda**.
2. Añade un coche a mano o pega texto de un anuncio. Revisa todos los datos sugeridos.
3. Compara candidatos y usa las preguntas de cada ficha para pedir pruebas al vendedor.
4. Descarga una copia JSON en **Datos y ayuda**. Los datos se guardan solo en este navegador.

La nota /100 indica el encaje con los límites del perfil; no certifica el estado mecánico ni estima el precio de mercado. Una respuesta afirmada por el vendedor no se cuenta como verificada.

## Extensión para Chrome

Descarga `radar-coche-extension.zip`, descomprímelo y abre `chrome://extensions`. Activa **Modo desarrollador**, pulsa **Cargar descomprimida** y elige la carpeta descomprimida. Fija el icono de Radar Coche en la barra de Chrome. Al pulsarlo mientras ves un anuncio aparece un **popup junto al icono**: muestra los datos detectados y habilita **Añadir anuncio** cuando hay indicios suficientes. Después abre la ficha para confirmar y completar los campos antes de guardarla.

Si ya tenías una versión anterior, exporta antes una copia JSON desde **Datos y ayuda**. En `chrome://extensions`, recarga la extensión antigua si apunta a la misma carpeta, o carga la carpeta nueva. Si cambia el identificador de la extensión, tendrás otro almacén y podrás importar la copia JSON.

La extensión usa permiso temporal sobre la pestaña activa al pulsar el icono. Lee texto visible y metadatos estructurados de esa página; no hace búsquedas masivas ni monitoriza pestañas en segundo plano. La web y la extensión tienen almacenes separados; mueve tus fichas con el JSON.

La captura automática está desactivada para Wallapop y Milanuncios. En esos casos, puedes introducir manualmente datos que hayas consultado tú. El archivo de la extensión es una prueba local; no está publicado en Chrome Web Store.

La detección reconoce precio al contado y financiado, año, kilómetros, combustible, cambio manual o automático, plazas, etiqueta ambiental y metadatos `Vehicle`/`Product`. Los portales cambian su HTML y algunos datos pueden salir incompletos; revisa la ficha antes de guardarla. Un precio financiado sin precio al contado no se toma como precio al contado.

El código de la extensión está en `extension-src/`. Para reconstruir el ZIP desde este repositorio:

```powershell
py scripts/build_extension.py
node --test tests/*.test.mjs
```

## Abrirla en local

Sirve esta carpeta por HTTP (los módulos JavaScript no funcionan de forma fiable con `file://`):

```powershell
py -m http.server 8765
```

Después abre `http://127.0.0.1:8765/`. La implementación no instala paquetes JavaScript.
