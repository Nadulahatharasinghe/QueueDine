import Restaurant from '../models/Restaurant';
import Table from '../models/Table';
import mongoose from 'mongoose';

export const seedRestaurantData = async (): Promise<void> => {
  try {
    const restaurantCount = await Restaurant.countDocuments();
    if (restaurantCount > 0) {
      console.log('Restaurant data already seeded, skipping.');
      return;
    }

    const restaurant = await Restaurant.create({
      name: 'Ember & Oak',
      location: 'Colombo, Sri Lanka',
      rating: 4.6,
      reviewCount: 1200,
      description:
        'A modern dining experience with delicious food, warm ambience and unforgettable moments.',
      openingHours: {
        open: '11:00',
        close: '23:00',
      },
      cuisine: 'Modern International',
    });

    const restaurantId = restaurant._id as mongoose.Types.ObjectId;

    const tables = [
      { tableNumber: 1, capacity: 2 },
      { tableNumber: 2, capacity: 2 },
      { tableNumber: 3, capacity: 4 },
      { tableNumber: 4, capacity: 4 },
      { tableNumber: 5, capacity: 4 },
      { tableNumber: 6, capacity: 4 },
      { tableNumber: 7, capacity: 6 },
      { tableNumber: 8, capacity: 6 },
      { tableNumber: 9, capacity: 8 },
      { tableNumber: 10, capacity: 10 },
    ];

    const tableDocs = tables.map((t) => ({
      ...t,
      restaurantId,
      status: 'available' as const,
    }));

    await Table.insertMany(tableDocs);

    console.log(
      `Seeded 1 restaurant (Ember & Oak, ID: ${restaurantId}) and ${tables.length} tables.`
    );
  } catch (error) {
    console.error('Seed error:', error);
  }
};
