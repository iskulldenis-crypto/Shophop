import React, { useState, useEffect } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, 
  addDoc, updateDoc, Timestamp, handleFirestoreError, OperationType 
} from './firebase';
import { UserProfile, Shop, Product, Order, OrderItem, Review } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, ShoppingBag, User, LogOut, Plus, MapPin, Phone, 
  CheckCircle2, Clock, Truck, XCircle, ChevronRight, 
  Search, Filter, ShoppingCart, Trash2, Edit, Camera, Star
} from 'lucide-react';

// --- Components ---

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className="mb-4"
    >
      <Store className="w-12 h-12 text-primary" />
    </motion.div>
    <p className="text-lg font-medium text-slate-600">Loading ShopHop...</p>
  </div>
);

const RoleSelection = ({ onSelect }: { onSelect: (role: 'client' | 'shopkeeper') => void }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to ShopHop</CardTitle>
        <CardDescription>Choose how you want to use the platform</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Button 
          variant="outline" 
          className="flex flex-col h-32 gap-2"
          onClick={() => onSelect('client')}
        >
          <ShoppingBag className="w-8 h-8" />
          <span>I'm a Shopper</span>
        </Button>
        <Button 
          variant="outline" 
          className="flex flex-col h-32 gap-2"
          onClick={() => onSelect('shopkeeper')}
        >
          <Store className="w-8 h-8" />
          <span>I'm a Shopkeeper</span>
        </Button>
      </CardContent>
    </Card>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleSelectionNeeded, setRoleSelectionNeeded] = useState(false);
  const [activeTab, setActiveTab] = useState('shops');
  
  // Client State
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  
  // Shopkeeper State
  const [myShop, setMyShop] = useState<Shop | null>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as UserProfile);
            setRoleSelectionNeeded(false);
          } else {
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: 'client', // Default, will be updated
              photoURL: firebaseUser.photoURL || ''
            });
            setRoleSelectionNeeded(true);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setRoleSelectionNeeded(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen for Shops
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'shops'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shopsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setShops(shopsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'shops'));
    return () => unsubscribe();
  }, [user]);

  // Listen for My Shop (Shopkeeper)
  useEffect(() => {
    if (user?.role !== 'shopkeeper') return;
    const q = query(collection(db, 'shops'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const shop = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Shop;
        setMyShop(shop);
      } else {
        setMyShop(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'shops'));
    return () => unsubscribe();
  }, [user]);

  // Listen for My Products (Shopkeeper)
  useEffect(() => {
    if (!myShop) return;
    const q = query(collection(db, 'shops', myShop.id, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setMyProducts(productsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `shops/${myShop.id}/products`));
    return () => unsubscribe();
  }, [myShop]);

  // Listen for My Orders (Shopkeeper)
  useEffect(() => {
    if (!myShop) return;
    const q = query(collection(db, 'orders'), where('shopId', '==', myShop.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setMyOrders(ordersData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));
    return () => unsubscribe();
  }, [myShop]);

  // Listen for Client Orders
  useEffect(() => {
    if (user?.role !== 'client') return;
    const q = query(collection(db, 'orders'), where('clientId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));
    return () => unsubscribe();
  }, [user]);

  // Listen for Selected Shop Products
  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `shops/${selectedShop.id}/products`));
    return () => unsubscribe();
  }, [selectedShop]);

  // Listen for Selected Shop Reviews
  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'reviews'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(reviewsData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `shops/${selectedShop.id}/reviews`));
    return () => unsubscribe();
  }, [selectedShop]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      toast.error('Login failed. Please try again.');
    }
  };

  const handleRoleSelect = async (role: 'client' | 'shopkeeper') => {
    if (!user) return;
    try {
      const updatedUser = { ...user, role };
      await setDoc(doc(db, 'users', user.uid), updatedUser);
      setUser(updatedUser);
      setRoleSelectionNeeded(false);
      toast.success(`Welcome! You are now a ${role}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }
  };

  const handleCreateShop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const shopData = {
      ownerId: user.uid,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      image: `https://picsum.photos/seed/${formData.get('name')}/800/400`,
      isOpen: true,
      location: formData.get('location') as string,
      paymentNumber: formData.get('paymentNumber') as string,
    };
    try {
      await addDoc(collection(db, 'shops'), shopData);
      toast.success('Shop created successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shops');
    }
  };

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!myShop) return;
    const formData = new FormData(e.currentTarget);
    const productData = {
      shopId: myShop.id,
      name: formData.get('name') as string,
      price: parseFloat(formData.get('price') as string),
      description: formData.get('description') as string,
      image: `https://picsum.photos/seed/${formData.get('name')}/400/400`,
      isAvailable: true,
    };
    try {
      await addDoc(collection(db, 'shops', myShop.id, 'products'), productData);
      toast.success('Product added!');
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `shops/${myShop.id}/products`);
    }
  };

  const toggleShopStatus = async () => {
    if (!myShop) return;
    try {
      await updateDoc(doc(db, 'shops', myShop.id), { isOpen: !myShop.isOpen });
      toast.success(`Shop is now ${!myShop.isOpen ? 'Open' : 'Closed'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${myShop.id}`);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const placeOrder = async (deliveryAddress: string, paymentNumber: string) => {
    if (!user || !selectedShop || cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderData = {
      clientId: user.uid,
      shopId: selectedShop.id,
      items: cart,
      total,
      status: 'pending',
      deliveryAddress,
      paymentNumber,
      createdAt: Timestamp.now()
    };
    try {
      await addDoc(collection(db, 'orders'), orderData);
      setCart([]);
      setSelectedShop(null);
      setActiveTab('orders');
      toast.success('Order placed! Waiting for shopkeeper to accept.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status'], extraData: Partial<Order> = {}) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status, ...extraData });
      toast.success(`Order status updated to ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const submitReview = async (shopId: string, rating: number, comment: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'shops', shopId, 'reviews'), {
        shopId,
        clientId: user.uid,
        clientName: user.name,
        rating,
        comment,
        createdAt: Timestamp.now()
      });
      toast.success('Review submitted!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `shops/${shopId}/reviews`);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50">
        <Store className="w-16 h-16 mb-6 text-primary" />
        <h1 className="mb-2 text-3xl font-bold">ShopHop</h1>
        <p className="mb-8 text-slate-600">Local shops at your fingertips</p>
        <Button onClick={handleLogin} size="lg" className="gap-2">
          <User className="w-5 h-5" />
          Sign in with Google
        </Button>
      </div>
    );
  }

  if (roleSelectionNeeded) {
    return <RoleSelection onSelect={handleRoleSelect} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white border-bottom">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold">ShopHop</span>
        </div>
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarImage src={user.photoURL} />
            <AvatarFallback>{user.name[0]}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" onClick={() => signOut(auth)}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {user.role === 'client' ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="shops">Shops</TabsTrigger>
              <TabsTrigger value="orders">My Orders</TabsTrigger>
            </TabsList>

            <TabsContent value="shops">
              {selectedShop ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <Button variant="ghost" onClick={() => setSelectedShop(null)} className="mb-4 gap-2">
                    <ChevronRight className="w-4 h-4 rotate-180" /> Back to Shops
                  </Button>
                  <div className="relative h-48 mb-6 overflow-hidden rounded-xl">
                    <img src={selectedShop.image} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-6 text-white">
                      <div className="flex justify-between items-end">
                        <div>
                          <h2 className="text-3xl font-bold">{selectedShop.name}</h2>
                          <p className="opacity-90">{selectedShop.category}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-bold">
                            {reviews.length > 0 
                              ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) 
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Tabs defaultValue="products" className="mb-6">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="products">Products</TabsTrigger>
                      <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="products">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {products.map(product => (
                          <Card key={product.id}>
                            <div className="flex h-32">
                              <img src={product.image} className="w-32 h-full object-cover rounded-l-lg" referrerPolicy="no-referrer" />
                              <div className="flex flex-col justify-between p-4 flex-1">
                                <div>
                                  <h3 className="font-bold">{product.name}</h3>
                                  <p className="text-sm text-slate-500 line-clamp-1">{product.description}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-primary">KSh {product.price}</span>
                                  <Button size="sm" onClick={() => addToCart(product)} disabled={!product.isAvailable || !selectedShop.isOpen}>
                                    {product.isAvailable && selectedShop.isOpen ? 'Add' : 'Unavailable'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                    <TabsContent value="reviews">
                      <div className="space-y-4 mt-4">
                        {reviews.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">No reviews yet</div>
                        ) : (
                          reviews.map(review => (
                            <Card key={review.id}>
                              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback>{review.clientName[0]}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-bold">{review.clientName}</p>
                                    <p className="text-xs text-slate-500">{review.createdAt?.toDate().toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
                                  ))}
                                </div>
                              </CardHeader>
                              <CardContent className="p-4 pt-0">
                                <p className="text-sm">{review.comment}</p>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  {cart.length > 0 && (
                    <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t shadow-lg flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <ShoppingCart className="w-6 h-6" />
                          <Badge className="absolute -top-2 -right-2 px-1.5 py-0.5 min-w-[1.25rem]">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Total: KSh {cart.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}</p>
                        </div>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button>Checkout</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Complete Your Order</DialogTitle>
                            <DialogDescription>Enter delivery and payment details</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Delivery Address</Label>
                              <Input id="address" placeholder="123 Street, City" />
                            </div>
                            <div className="space-y-2">
                              <Label>Payment Number (Mobile Money)</Label>
                              <Input id="payment" placeholder="e.g. 0700000000" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={() => {
                              const addr = (document.getElementById('address') as HTMLInputElement).value;
                              const pay = (document.getElementById('payment') as HTMLInputElement).value;
                              if (addr && pay) placeOrder(addr, pay);
                              else toast.error('Please fill all fields');
                            }}>Place Order</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input className="pl-10" placeholder="Search shops or categories..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shops.map(shop => (
                      <Card key={shop.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedShop(shop)}>
                        <div className="relative h-40 overflow-hidden rounded-t-xl">
                          <img src={shop.image} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                          <Badge className={`absolute top-2 right-2 ${shop.isOpen ? 'bg-green-500' : 'bg-red-500'}`}>
                            {shop.isOpen ? 'Open' : 'Closed'}
                          </Badge>
                        </div>
                        <CardHeader className="p-4">
                          <CardTitle className="text-lg">{shop.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {shop.location}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders">
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No orders yet</div>
                ) : (
                  orders.map(order => (
                    <Card key={order.id}>
                      <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle className="text-sm">Order #{order.id.slice(-6)}</CardTitle>
                          <CardDescription>{order.createdAt?.toDate().toLocaleString()}</CardDescription>
                        </div>
                        <Badge variant={
                          order.status === 'completed' ? 'default' : 
                          order.status === 'cancelled' ? 'destructive' : 'secondary'
                        }>
                          {order.status.toUpperCase()}
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        {order.status === 'accepted' && order.estimatedDeliveryTime && (
                          <div className="mb-3 p-2 bg-blue-50 text-blue-700 rounded-lg text-xs flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            <span>Estimated Delivery: <strong>{order.estimatedDeliveryTime}</strong></span>
                          </div>
                        )}
                        {order.status === 'cancelled' && order.cancellationReason && (
                          <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2">
                            <XCircle className="w-4 h-4" />
                            <span>Reason: <strong>{order.cancellationReason}</strong></span>
                          </div>
                        )}
                        <div className="text-sm space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{item.quantity}x {item.name}</span>
                              <span>KSh {(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                          <Separator className="my-2" />
                          <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span>KSh {order.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </CardContent>
                      {order.status === 'completed' && (
                        <CardFooter className="p-4 pt-0">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full gap-2">
                                <Star className="w-4 h-4" /> Rate Shop
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Rate Your Experience</DialogTitle>
                                <DialogDescription>How was your order from {shops.find(s => s.id === order.shopId)?.name}?</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="flex justify-center gap-2">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <Button 
                                      key={s} 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => (document.getElementById('rating-input') as HTMLInputElement).value = s.toString()}
                                    >
                                      <Star className="w-8 h-8 text-yellow-400" />
                                    </Button>
                                  ))}
                                  <input type="hidden" id="rating-input" defaultValue="5" />
                                </div>
                                <div className="space-y-2">
                                  <Label>Comment</Label>
                                  <Input id="review-comment" placeholder="Tell us more..." />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={() => {
                                  const rating = parseInt((document.getElementById('rating-input') as HTMLInputElement).value);
                                  const comment = (document.getElementById('review-comment') as HTMLInputElement).value;
                                  submitReview(order.shopId, rating, comment);
                                }}>Submit Review</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </CardFooter>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            {!myShop ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create Your Shop</CardTitle>
                  <CardDescription>Start selling to local customers today</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateShop} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Shop Name</Label>
                      <Input name="name" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input name="category" placeholder="e.g. Grocery, Electronics" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input name="location" placeholder="Physical address" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Number</Label>
                      <Input name="paymentNumber" placeholder="Mobile money number" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input name="description" />
                    </div>
                    <Button type="submit" className="w-full">Launch Shop</Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="dashboard">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger value="products">Products</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>{myShop.name}</CardTitle>
                          <CardDescription>{myShop.category} • {myShop.location}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs uppercase font-bold text-slate-500">
                            {myShop.isOpen ? 'Open' : 'Closed'}
                          </Label>
                          <Switch checked={myShop.isOpen} onCheckedChange={toggleShopStatus} />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-100 rounded-lg text-center">
                            <p className="text-2xl font-bold">{myOrders.filter(o => o.status === 'pending').length}</p>
                            <p className="text-xs text-slate-500 uppercase">Pending Orders</p>
                          </div>
                          <div className="p-4 bg-slate-100 rounded-lg text-center">
                            <p className="text-2xl font-bold">KSh {myOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total, 0).toLocaleString()}</p>
                            <p className="text-xs text-slate-500 uppercase">Total Revenue</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Shop Availability</CardTitle>
                        <CardDescription>Control when customers can see and order from your shop</CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${myShop.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                          <span className="font-medium">Currently {myShop.isOpen ? 'Accepting Orders' : 'Offline'}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={toggleShopStatus}>
                          Toggle Now
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="products">
                  <div className="space-y-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full gap-2">
                          <Plus className="w-4 h-4" /> Add New Product
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Product</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddProduct} className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Product Name</Label>
                            <Input name="name" required />
                          </div>
                          <div className="space-y-2">
                            <Label>Price (KSh)</Label>
                            <Input name="price" type="number" step="0.01" required />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input name="description" />
                          </div>
                          <Button type="submit" className="w-full">Save Product</Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <div className="grid grid-cols-1 gap-4">
                      {myProducts.map(product => (
                        <Card key={product.id}>
                          <div className="flex h-24">
                            <img src={product.image} className="w-24 h-full object-cover rounded-l-lg" referrerPolicy="no-referrer" />
                            <div className="flex flex-col justify-between p-3 flex-1">
                              <div className="flex justify-between items-start">
                                <h3 className="font-bold">{product.name}</h3>
                                <span className="font-bold text-primary">KSh {product.price}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <Badge variant={product.isAvailable ? 'default' : 'secondary'}>
                                  {product.isAvailable ? 'In Stock' : 'Out of Stock'}
                                </Badge>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="orders">
                  <div className="space-y-4">
                    {myOrders.map(order => (
                      <Card key={order.id} className={order.status === 'pending' ? 'border-primary' : ''}>
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                          <div>
                            <CardTitle className="text-sm">Order #{order.id.slice(-6)}</CardTitle>
                            <CardDescription>{order.createdAt?.toDate().toLocaleString()}</CardDescription>
                          </div>
                          <Badge>{order.status.toUpperCase()}</Badge>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="text-sm mb-4">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{item.quantity}x {item.name}</span>
                                <span>KSh {(item.price * item.quantity).toLocaleString()}</span>
                              </div>
                            ))}
                            <Separator className="my-2" />
                            <div className="flex justify-between font-bold">
                              <span>Total</span>
                              <span>KSh {order.total.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="p-3 bg-slate-100 rounded-lg text-xs space-y-1 mb-4">
                            <p><strong>Address:</strong> {order.deliveryAddress}</p>
                            <p><strong>Payment No:</strong> {order.paymentNumber}</p>
                          </div>
                          <div className="flex gap-2">
                            {order.status === 'pending' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button className="flex-1">Accept</Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Accept Order</DialogTitle>
                                    <DialogDescription>Provide an estimated delivery time for the customer.</DialogDescription>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <Label>Estimated Time</Label>
                                    <Input id={`est-${order.id}`} placeholder="e.g. 20-30 mins" />
                                  </div>
                                  <DialogFooter>
                                    <Button onClick={() => {
                                      const est = (document.getElementById(`est-${order.id}`) as HTMLInputElement).value;
                                      updateOrderStatus(order.id, 'accepted', { estimatedDeliveryTime: est || '30-45 mins' });
                                    }}>Confirm Acceptance</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                            {order.status === 'accepted' && (
                              <Button className="flex-1" onClick={() => updateOrderStatus(order.id, 'delivering')}>Start Delivery</Button>
                            )}
                            {order.status === 'delivering' && (
                              <Button className="flex-1" onClick={() => updateOrderStatus(order.id, 'completed')}>Complete</Button>
                            )}
                            {order.status === 'pending' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" className="flex-1">Decline</Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Decline Order</DialogTitle>
                                    <DialogDescription>Please provide a reason for the customer.</DialogDescription>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <Label>Reason</Label>
                                    <Input id={`reason-${order.id}`} placeholder="e.g. Out of stock, Too busy" />
                                  </div>
                                  <DialogFooter>
                                    <Button variant="destructive" onClick={() => {
                                      const reason = (document.getElementById(`reason-${order.id}`) as HTMLInputElement).value;
                                      updateOrderStatus(order.id, 'cancelled', { cancellationReason: reason || 'Shop unavailable' });
                                    }}>Confirm Decline</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-10">
        <Button 
          variant="ghost" 
          className={`flex flex-col gap-1 h-auto ${activeTab === 'shops' || activeTab === 'dashboard' ? 'text-primary' : 'text-slate-500'}`}
          onClick={() => setActiveTab(user.role === 'client' ? 'shops' : 'dashboard')}
        >
          {user.role === 'client' ? <ShoppingBag className="w-6 h-6" /> : <Store className="w-6 h-6" />}
          <span className="text-[10px] uppercase font-bold">{user.role === 'client' ? 'Shops' : 'Home'}</span>
        </Button>
        <Button 
          variant="ghost" 
          className={`flex flex-col gap-1 h-auto ${activeTab === 'orders' ? 'text-primary' : 'text-slate-500'}`}
          onClick={() => setActiveTab('orders')}
        >
          <Clock className="w-6 h-6" />
          <span className="text-[10px] uppercase font-bold">Orders</span>
        </Button>
        <Button 
          variant="ghost" 
          className="flex flex-col gap-1 h-auto text-slate-500"
          onClick={() => toast.info('Profile settings coming soon!')}
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] uppercase font-bold">Profile</span>
        </Button>
      </nav>
      <Toaster position="top-center" />
    </div>
  );
}
