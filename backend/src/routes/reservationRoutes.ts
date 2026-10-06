import { Router } from 'express';
import {
  checkAvailability,
  createReservation,
  getMyReservations,
  getReservationById,
  cancelReservation,
  modifyReservation,
} from '../controllers/reservationController';

const router = Router();

router.post('/check-availability', checkAvailability);
router.post('/', createReservation);
router.get('/', getMyReservations);
router.get('/:id', getReservationById);
router.put('/:id/cancel', cancelReservation);
router.put('/:id', modifyReservation);

export default router;
