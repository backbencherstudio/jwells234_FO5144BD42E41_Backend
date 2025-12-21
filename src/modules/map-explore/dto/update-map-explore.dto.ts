import { PartialType } from '@nestjs/mapped-types';
import { CreateMapExploreDto } from './create-map-explore.dto';

export class UpdateMapExploreDto extends PartialType(CreateMapExploreDto) {}
