export type Category = "pagnes" | "femmes" | "hommes" | "enfants" | "accessoires";

export type OrderStatus = "recue" | "prep" | "route" | "livree";

export type PaymentMethod = "wave" | "orange" | "mtn" | "moov" | "card" | "cod" | "transfer";

export type PaymentStatus = "pending" | "paid" | "failed";

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  colors: string[];
  sizes: string[];
  description: string;
  is_new: boolean;
  image_url: string | null;
  in_stock: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  points: number;
  role: "customer" | "admin";
  created_at: string;
}

export interface OrderItem {
  id?: string;
  product_id: string | null;
  name: string;
  price: number;
  qty: number;
  size: string | null;
  color: string | null;
}

export interface OrderMeasures {
  poitrine: number | null;
  taille: number | null;
  hanches: number | null;
  longueur: number | null;
  note: string | null;
}

export interface Order {
  id: string;
  ref: string;
  user_id: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  points_used: number;
  points_earned: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  commune: string;
  address: string;
  note: string | null;
  created_at: string;
  items: OrderItem[];
  measures: OrderMeasures | null;
}

export interface CartItem {
  key: string;
  productId: string;
  name: string;
  price: number;
  image: string | null;
  category: Category;
  size: string;
  color: string;
  qty: number;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string;
  order_ref: string | null;
  read: boolean;
  created_at: string;
}
