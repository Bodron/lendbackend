import { Types } from "mongoose";
import { MessagesGateway } from "./messages.gateway";

jest.mock("../auth/auth.service", () => ({ AuthService: class {} }));

describe("availability socket", () => {
  it("joins a product room and broadcasts only a refresh signal", () => {
    const productId = new Types.ObjectId().toString();
    const join = jest.fn();
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const gateway = new MessagesGateway({} as any, {} as any);
    gateway.server = { to } as any;

    gateway.joinAvailability({ join } as any, { productId });
    gateway.broadcastAvailability(productId);

    expect(join).toHaveBeenCalledWith(`availability:${productId}`);
    expect(to).toHaveBeenCalledWith(`availability:${productId}`);
    expect(emit).toHaveBeenCalledWith("availability.changed", { productId });
  });
});
