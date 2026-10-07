import { StaffError } from '../staff/domain';
import { StaffRestaurant, StaffAccount } from '../staff/models';
import Restaurant, { IRestaurant } from '../models/Restaurant';
import { InferSchemaType, HydratedDocument } from 'mongoose';

type StaffAccountDoc = HydratedDocument<InferSchemaType<typeof StaffAccount.schema>>;
type StaffRestaurantDoc = HydratedDocument<InferSchemaType<typeof StaffRestaurant.schema>>;

export interface ResolvedStaffRestaurant {
  staffRestaurant: StaffRestaurantDoc;
  customerRestaurant: IRestaurant;
}

export async function resolveStaffRestaurant(
  account: StaffAccountDoc
): Promise<ResolvedStaffRestaurant> {
  if (!account?.restaurantId) {
    throw new StaffError(503, 'This staff account is not assigned to a restaurant.');
  }
  const staffRestaurant = await StaffRestaurant.findById(account.restaurantId);
  if (!staffRestaurant) {
    throw new StaffError(503, 'The assigned restaurant could not be loaded.');
  }
  const customerRestaurant = await Restaurant.findOne({
    name: staffRestaurant.name,
  });
  if (!customerRestaurant) {
    throw new StaffError(
      503,
      'The customer listing for this restaurant is not configured. Contact your manager.'
    );
  }
  return { staffRestaurant, customerRestaurant };
}
