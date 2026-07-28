import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get("me")
  async findMine(@Headers("authorization") authorization?: string) {
    const user = await this.getUser(authorization);
    return this.productsService.findMine(user.id, user.fullName);
  }

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateProductDto,
  ) {
    const user = await this.getUser(authorization);
    return this.productsService.create(user, dto);
  }

  @Patch(":id")
  async update(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const user = await this.getUser(authorization);
    return this.productsService.update(user, id, dto);
  }

  @Post("seed")
  async seed() {
    const products = await this.productsService.seedMockProducts();

    return {
      count: products.length,
      products,
    };
  }

  @Get(":slug")
  async findBySlug(@Param("slug") slug: string) {
    const product = await this.productsService.findBySlug(slug);

    if (!product) {
      throw new NotFoundException("Produsul nu a fost gasit.");
    }

    return product;
  }

  private async getUser(authorization?: string) {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    const payload = this.authService.verifyToken(token);
    return this.authService.getProfile(payload.sub);
  }
}
