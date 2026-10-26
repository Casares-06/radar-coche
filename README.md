# Radar Coche

Web estática para guardar y comparar anuncios de coches usados con tus propios límites. Funciona en el navegador sin cuenta, servidor de datos, IA local ni API de pago.

1. Abre la web y define **Mi búsqueda**.
2. Añade un coche a mano o pega texto de un anuncio. Revisa todos los datos sugeridos.
3. Compara candidatos y usa las preguntas de cada ficha para pedir pruebas al vendedor.
4. Descarga una copia JSON en **Datos y ayuda**. Los datos se guardan solo en este navegador.

La nota /100 indica el encaje con los límites del perfil; no certifica el estado mecánico ni estima el precio de mercado. Una respuesta afirmada por el vendedor no se cuenta como verificada.

## Extensión para Chrome

Descarga `radar-coche-extension.zip`, descomprímelo y abre `chrome://extensions`. Activa **Modo desarrollador**, pulsa **Cargar descomprimida** y elige la carpeta descomprimida. Al pulsar el icono de la extensión en un anuncio compatible se abrirá el panel con los campos detectados para revisarlos. No hace búsquedas masivas ni monitoriza pestañas en segundo plano. La web y la extensión tienen almacenes separados; mueve tus fichas con el JSON.

La captura automática está desactivada para Wallapop y Milanuncios. En esos casos, puedes introducir manualmente datos que hayas consultado tú. El archivo de la extensión es una prueba local; no está publicado en Chrome Web Store.

## Abrirla en local

Sirve esta carpeta por HTTP (los módulos JavaScript no funcionan de forma fiable con `file://`):

```powershell
py -m http.server 8765
```

Después abre `http://127.0.0.1:8765/`. La implementación no instala paquetes JavaScript.
