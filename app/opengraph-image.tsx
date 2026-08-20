import { ImageResponse } from "next/og";

export const alt = "Loopy — comparte tu ubicación en tiempo real";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Mismo ícono que components/LoopyLogo.tsx (ICON_SRC) — se duplica acá en
// vez de importarlo porque ese archivo es "use client" y este es un route
// handler especial de next/og, con su propio runtime edge.
const ICON_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAkCAMAAAAdBYxUAAAAeFBMVEXUaufopvTkmPSnVa73qvzy2ffzyvr8e/y4Wcfjsu7/AP+5c7m1a/+zs/+qqqp/FX9/f/9/f3+hZ6cAAP/2wv6/P7+4hbt/P79/f79///+6hry6hMG+i8G////SfvXqx/8AAADth/7+/v7od/3zlv6sVLTVZurFXNOGreAoAAAAKHRSTlP8oeD5BSpcAv5mAQMDAwMCAgJoAYME2AQEAmhosQSb5QD9Bv35/v39bHqPDQAAA79JREFUeNp1louaoygQhYGAKObSPd0ze98lhZf3f8M9p9BoTDf5kqAe/iqKKsTk5ybiL96/Sf62iUBwkaPC7C/S5bx2vf+a5ePai8+KPcjTXmjQ1N4rKvm0KsJRsYEkZWmsYxucs428oHgFxYDmVsUrCLcaaO5Lg5ZCeXL4j8ZSUUoVuE88TgfQOQf7oCwsouLO4WCHnUQdg0KeQInubBL9K2WwDx06O0WV8Wv/SbKB0iXv3Vm6BVNwkt+qP3J0uGruVmJ6gHzu1sH0mOEkhs0KLYrfOBrqXTBtnT5BMTfDirFY2RAQVJIMPlY05g+F67D0ooqF1CgJIIniqooxWWNr78aYUiZMDqjGLcO6nWJBuUBbhhNr7mVhI3W8yJvARnAEFYLQr4EbAhVR0JguC6lj7pickrjK6XYZCBRuT4WqtHhMzk6xRha20gdAcGgoNWp+n8cXTg/wS8T/Moed4uJxobMrpUOUCKq6AS4fKkJQUahS+5j5+bAPSAXRBZM/quNHh5baqhwWxdDtBdJ1Ob2pD8UwjgbfGkeb4ku1izA1NKHuyJe1rpCkwbShzo1ZEhQUagRsjq/bT0RAS3U/pMfM01maqeUUPhVkQo4KUoufX4CYGaaQ47b6hZfwc2q7mjg7kNMktodQKifcpwmJae7hsaOIRrlxQAe1g3TzS4yU+u8LCI/cxEbOJddtGjd19/sP6LPYomYYbETUEoRaOEQbKWmNgjRR8LCXnJhVNfZn1pbawVBhHnUM2DR1z+svyoG9GU+iYKHCkvCcrQuRqW0WO8wjRtvwxlPi5h4cDc88WS0MVDFqOtbRxrIX2DMzYv3OooWzZYJtkm5edw3xP8Eps4KcxKiaqUCRPF1ycsbm7IhpWys3rf4I8jxj0GS6zaOgM5jnFoMxIS7fNEMBO0hGChsHZ+b21Db5Wjc2yXZqSZqN7dSj0FlDdyA7MQAoOVy1EE0OKOtQIlatz+1oJa5b7VncXO+2CKO12InG09iikXPVWrHTTNCMaWH5IZnbtipqipm60KG6yaZWTmjjqJz+sYRqDL+mpZFxVNXCWV5H73hncfzWCMKnyT93yUCn50pYRSdPj7f3murW56uGnH63p3T0qa1Gqmb8FRbO400rXAU6sVLQR9pcdwl64zq1p6VR9guBfz++++WDZwiEWEnj6W8u9PWpZnpVnPgYtrjCedsxzOFU45vux4+/Oj219PKyG+ipBoo/q+IqX56PxN/2o744acm1/05hDsr3vv/9t76P8v3Jz/e3W98fz37/Ayy0AOPkg44PAAAAAElFTkSuQmCC";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #3d4a8a 0%, #834c9c 55%, #ec6fc9 100%)",
        }}
      >
        <img src={ICON_SRC} width={220} height={112} alt="" />
        <div
          style={{
            display: "flex",
            fontSize: 104,
            fontWeight: 800,
            color: "#ffffff",
            marginTop: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Loopy
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "rgba(255,255,255,0.88)",
            marginTop: 18,
          }}
        >
          Comparte tu ubicación, a tu manera
        </div>
      </div>
    ),
    { ...size }
  );
}
