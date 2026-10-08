import { StaffError } from '../staff/domain';
import { StaffRestaurant, StaffAccount } from '../staff/models';
import Restaurant, { IRestaurant } from '../models/Restaurant';
import { InferSchemaType, HydratedDocument, Types } from 'mongoose';

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

  let customerRestaurant: IRestaurant | null = null;

  if (staffRestaurant.customerRestaurantId) {
    try {
      customerRestaurant = await Restaurant.findById(staffRestaurant.customerRestaurantId);
    } catch {
      customerRestaurant = null;
    }
  }

  if (!customerRestaurant) {
    customerRestaurant = await Restaurant.findOne({
      name: staffRestaurant.name,
    });
    if (customerRestaurant) {
      try {
        staffRestaurant.customerRestaurantId = customerRestaurant._id as Types.ObjectId;
        await staffRestaurant.save();
        console.info(`[restaurantLink] Backfilled customerRestaurantId for staff restaurant ${staffRestaurant._id} -> ${customerRestaurant._id}`);
      } catch (error) {
        console.warn('[restaurantLink] Could not backfill customerRestaurantId:', error instanceof Error ? error.message : error);
      }
    }
  }

  if (!customerRestaurant) {
    throw new StaffError(
      503,
      'The customer listing for this restaurant is not configured. Contact your manager.'
    );
  }
  return { staffRestaurant, customerRestaurant };
}

export async function getCustomerRestaurantIdForStaff(
  account: StaffAccountDoc
): Promise<Types.ObjectId> {
  const { customerRestaurant } = await resolveStaffRestaurant(account);
  return customerRestaurant._id as Types.ObjectId;
}

export async function findStaffRestaurantByCustomerId(
  customerRestaurantId: Types.ObjectId | string
): Promise<StaffRestaurantDoc | null> {
  const oid = typeof customerRestaurantId === 'string'
    ? new Types.ObjectId(customerRestaurantId)
    : customerRestaurantId;
  const direct = await StaffRestaurant.findOne({ customerRestaurantId: oid });
  if (direct) return direct;
  const rest = await Restaurant.findById(oid);
  if (!rest) return null;
  const byName = await StaffRestaurant.findOne({ name: rest.name });
  if (byName && !byName.customerRestaurantId) {
    try {
      byName.customerRestaurantId = rest._id as Types.ObjectId;
      await byName.save();
      console.info(`[restaurantLink] Reverse backfilled customerRestaurantId for staff restaurant ${byName._id}`);
    } catch (error) {
      console.warn('[restaurantLink] Reverse backfill failed:', error instanceof Error ? error.message : error);
    }
  }
  return byName;
}
