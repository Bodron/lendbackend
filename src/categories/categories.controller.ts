import { Controller, Get, Post } from "@nestjs/common";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post("seed")
  async seed() {
    const categories = await this.categoriesService.seedMockCategories();

    return {
      count: categories.length,
      categories,
    };
  }
}
