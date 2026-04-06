export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'client' | 'shopkeeper';
  phone?: string;
  photoURL?: string;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  image: string;
  isOpen: boolean;
  location: string;
  paymentNumber: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  price: number;
  image: string;
  description: string;
  isAvailable: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  clientId: string;
  shopId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'accepted' | 'delivering' | 'completed' | 'cancelled';
  deliveryAddress: string;
  paymentNumber: string;
  createdAt: any;
  estimatedDeliveryTime?: string;
  cancellationReason?: string;
}

export interface Review {
  id: string;
  shopId: string;
  clientId: string;
  clientName: string;
  rating: number;
  comment: string;
  createdAt: any;
}
