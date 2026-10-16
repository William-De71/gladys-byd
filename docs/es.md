# BYD

## Presentación

Esta integración lleva sus coches BYD a Gladys a través de la nube de la app **BYD** internacional (no la app para China): batería, autonomía, carga, cierre, puertas, ventanillas, climatización, presión de neumáticos, alertas y posición. Con el PIN de control remoto de la app, Gladys también puede cerrar y abrir el coche, encender o apagar el clima, hacer destellar las luces y lanzar «localizar coche».

BYD no publica ninguna API: la integración habla el protocolo de la app, a partir de la biblioteca libre pyBYD (usada por la integración de Home Assistant). BYD puede cambiarlo en cualquier momento.

## Requisitos previos

- Gladys Assistant 5.1.1 o posterior.
- Un coche BYD conectado a la app BYD, y el correo electrónico y la contraseña de la cuenta de la app.
- Recomendado: una segunda cuenta BYD con la que se comparta el coche (se comparte desde la app). La app puede cerrar la sesión de su teléfono cuando Gladys inicia sesión con la misma cuenta.
- Para los comandos: el **PIN de control remoto** de 6 cifras definido en la app BYD por la cuenta que usa Gladys (una cuenta compartida define el suyo).

## Configuración

| Campo                 | Función                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Correo electrónico    | La cuenta de la app BYD.                                                                     |
| Contraseña            | Su contraseña, guardada como secreto.                                                        |
| País de la cuenta     | Código de dos letras del país donde se creó la cuenta (ES, MX, AR…): elige el servidor.      |
| PIN de control remoto | Las 6 cifras de la app. Vacío: solo lectura.                                                 |
| Intervalo de lectura  | 5 a 480 minutos (15 por defecto). Cada lectura despierta el coche y gasta algo de batería.   |
| Temperatura del clima | 15 a 31 °C, pedida al encender el clima desde Gladys.                                        |
| Duración del clima    | 10, 15, 20, 25 o 30 minutos.                                                                 |
| Radio de la vivienda  | Por debajo de esta distancia a una vivienda de Gladys (con posición), el coche está en casa. |
| Idioma de los textos  | Idioma de los nombres, estados y resúmenes de escenas.                                       |

Guarde y haga clic en **Probar la conexión**: lista los coches de la cuenta.

## Uso

### Dispositivos

En **Descubrir**, añada sus coches. Cada coche ofrece las funcionalidades que informa: batería, autonomía eléctrica (y combustible para los híbridos enchufables), cuentakilómetros, cable de carga, estado de la carga, tiempo hasta carga completa, temperatura interior, cierre, puertas y maletero, ventanillas, climatización, presión de los cuatro neumáticos (en bar), alertas y distancia de casa. Vuelva a escanear tras un primer trayecto si falta una funcionalidad.

El cierre y el clima son comandos: necesitan el PIN. Un comando se envía en segundo plano; el coche responde en menos de un minuto y se vuelve a leer 30 segundos después.

### Widget de panel

El widget **Coche BYD** muestra la foto del modelo, la batería, la autonomía, el cierre, las aperturas, la carga, la temperatura interior, el clima, la posición, las alertas y la antigüedad de los datos, con botones para cerrar o abrir, encender o apagar el clima, destellar las luces y abrir el mapa.

![Dos tarjetas del widget BYD: un coche cargando en casa, otro aparcado en la ciudad (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-byd/main/docs/assets/widgets.es.png)

### Escenas

Disparadores: cerrado o abierto, cerrado pero abierto, carga iniciada o detenida, cable enchufado o desenchufado, llegada o salida de casa, testigo de alerta encendido, problema de cuenta. Acciones: enviar un comando (espera al coche), leer el estado del coche.

- Cuando el coche llega a casa → enviar «Enchufa el coche: {{triggerEvent.data.battery_level}} %».
- Cuando el coche está cerrado pero abierto → enviar {{triggerEvent.data.summary}}.
- Cada día laborable a las 7:40 → enviar el comando «Encender la climatización».

### Transporte

Todo pasa por la nube de BYD de su región (insignia **nube**). Un punto naranja significa que BYD ve el coche sin conexión: los valores pueden ser antiguos.

## Solución de problemas

- **Inicio de sesión rechazado**: compruebe el correo, la contraseña y el país. Tras un rechazo, la integración espera 15 minutos (luego 30, hasta 4 horas) antes de reintentar, para que BYD no bloquee la cuenta; guardar la configuración reintenta de inmediato.
- **PIN rechazado**: todos los comandos se detienen hasta que cambie el PIN en la configuración. Varios PIN erróneos bloquean el control remoto del coche durante el día.
- **Se cerró la sesión de su teléfono**: use una segunda cuenta con la que se comparta el coche.
- **Valores antiguos, «coche sin conexión»**: el coche no tiene red móvil (aparcamiento subterráneo) o duerme profundamente; los comandos pueden fallar hasta que se reconecte.
- **Falta un valor o parece erróneo**: haga clic en **Diagnóstico** en la configuración y copie las líneas que empiezan por «BYD diagnostic» de la pestaña Registros en una issue de GitHub (VIN, matrícula y posición se omiten).
