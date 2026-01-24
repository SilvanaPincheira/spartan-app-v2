export type MaquinaPromo = {
    codigo: string;
    nombre: string;
    precio: number;
    imagen: string;
  };
  
  export const MAQUINAS_PROMO: MaquinaPromo[] = [
    {
      codigo: "MQV5107011",
      nombre: "Vacuolavadora Fimap iMX BB CB",
      precio: 3580000,
      imagen: "/promociones/maquinas/imx-bb-cb.png",
    },
    {
      codigo: "MQV5107817",
      nombre: "Vacuolavadora Fimap MY50E",
      precio: 2585000,
      imagen: "/promociones/maquinas/my50e.png",
    },
    {
      codigo: "MQV5111502",
      nombre: "Vacuolavadora Fimap MR 85B CB",
      precio: 9690000,
      imagen: "/promociones/maquinas/mr85b-cb.png",
    },
  ];
  