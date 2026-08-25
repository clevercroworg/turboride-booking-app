export type Car = {
  id: string
  name: string
  brand: string
  watermark: string
  watermarkStyle: "script" | "block"
  image: string
  acceleration: string
  power: string
  topSpeed: string
  status: "available" | "coming-soon"
  price: string
}

export const cars: Car[] = [
  {
    id: "911-gt3",
    name: "911 GT3",
    brand: "Porsche",
    watermark: "911",
    watermarkStyle: "block",
    image: "/cars/car-911-gt3.png",
    acceleration: "3.4",
    power: "375 (kW) / 503 (hp)",
    topSpeed: "311",
    status: "coming-soon",
    price: "10,000",
  },
  {
    id: "718-cayman",
    name: "718 Cayman",
    brand: "Porsche",
    watermark: "718",
    watermarkStyle: "block",
    image: "/cars/car-718.png",
    acceleration: "5.1",
    power: "220 (kW) / 300 (hp)",
    topSpeed: "275",
    status: "available",
    price: "5,000",
  },
  {
    id: "ferrari-488-gtb",
    name: "Ferrari 488 GTB",
    brand: "Ferrari",
    watermark: "488 GTB",
    watermarkStyle: "block",
    image: "/cars/car-ferrari-488.png",
    acceleration: "3.0",
    power: "492 (kW) / 661 (hp)",
    topSpeed: "330",
    status: "coming-soon",
    price: "10,000",
  },
  {
    id: "mclaren-720s",
    name: "McLaren 720S",
    brand: "McLaren",
    watermark: "720S",
    watermarkStyle: "block",
    image: "/cars/car-mclaren-720s.png",
    acceleration: "2.9",
    power: "530 (kW) / 710 (hp)",
    topSpeed: "341",
    status: "coming-soon",
    price: "10,000",
  },
  {
    id: "mustang-gt",
    name: "Mustang GT",
    brand: "Ford",
    watermark: "Mustang",
    watermarkStyle: "script",
    image: "/cars/car-mustang-gt.png",
    acceleration: "4.3",
    power: "331 (kW) / 450 (hp)",
    topSpeed: "250",
    status: "coming-soon",
    price: "5,000",
  },
  {
    id: "lamborghini-huracan",
    name: "Lamborghini Huracán",
    brand: "Lamborghini",
    watermark: "Huracán",
    watermarkStyle: "script",
    image: "/cars/car-huracan.png",
    acceleration: "2.9",
    power: "470 (kW) / 631 (hp)",
    topSpeed: "325",
    status: "coming-soon",
    price: "10,000",
  },
]
