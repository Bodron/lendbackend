import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { mockCategories } from "./mock-categories";
import { Category, CategoryDocument } from "./schemas/category.schema";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async findAll(): Promise<CategoryDocument[]> {
    return this.categoryModel
      .find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async seedMockCategories(): Promise<CategoryDocument[]> {
    const categories: CategoryDocument[] = [];

    for (const category of mockCategories) {
      const savedCategory = await this.categoryModel
        .findOneAndUpdate(
          { slug: category.slug },
          {
            $set: {
              name: category.name,
              slug: category.slug,
              description: category.description,
              iconName: category.iconName,
              sortOrder: category.sortOrder,
              isActive: true,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        )
        .exec();

      categories.push(savedCategory);
    }

    return categories;
  }
}
