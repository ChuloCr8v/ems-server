import { IsArray, IsNotEmpty, IsString, isString } from "class-validator";

export class createLeadershipAssessmentItemDto {
    @IsArray()
    @IsNotEmpty()
    items: leadershipItem[]
}

export class leadershipItem {
    @IsString()
    @IsNotEmpty()
    title: string
}