import { Injectable } from '@nestjs/common';
import { SazedStorage } from './common/lib/Disk/SazedStorage';

@Injectable()
export class AppService {
  getHello() {
    return {
      success: true,
      statusCode: 200,
      message: 'Hello world',
    };
  }

  async test(image: Express.Multer.File) {
    try {
      const fileName = image.originalname;
      const fileType = image.mimetype;
      const fileSize = image.size;
      const fileBuffer = image.buffer;

      const result = await SazedStorage.put(fileName, fileBuffer);

      return {
        success: true,
        statusCode: 201,
        message: 'Image uploaded successfully',
        data: result,
        url: SazedStorage.url('tony1.jpg'),
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: `Failed to upload image: ${error.message || error}`,
      };
    }
  }
}
