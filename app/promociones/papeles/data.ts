// app/promociones/papeles/data.ts

export type PapelPromo = {
    codigo: string;
    nombre: string;
    precio: number;
    imagen: string;
  };
  
  export const PAPELES_PROMO: PapelPromo[] = [
    {
      codigo: "ACN1503018",
      nombre: "Papel interfoliado extra blanco doble hoja 18x200 HJS",
      precio: 29990,
      imagen: "/promociones/papeles/toalla-interfoliada-40844.png",
    },
    {
      codigo: "ACN1540975",
      nombre: "Paño Maxwipe MAX70 bobina x750",
      precio: 51990,
      imagen: "/promociones/papeles/maxwipe-max70-40975.png",
    },
    {
      codigo: "ACN1501002",
      nombre: "Papel toalla jumbo 2 rollos 250 mts",
      precio: 9490,
      imagen: "/promociones/papeles/toalla-2x250-40862.png",
    },
    {
      codigo: "ACN1540250",
      nombre: "Papel toalla autocorte 2x250 mts",
      precio: 13590,
      imagen: "/promociones/papeles/autocorte-2x250-40254.png",
    },
    {
      codigo: "ACN1502002",
      nombre: "Papel higiénico jumbo ECO 4x500 mts",
      precio: 10090,
      imagen: "/promociones/papeles/higienico-52093.png",
    },
  ];
  