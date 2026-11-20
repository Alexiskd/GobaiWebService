// ApiProperty et ApiPropertyOptional : décrivent un champ, obligatoire ou facultatif, dans la documentation Swagger.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Type : indique en quelle classe convertir une valeur reçue en JSON.
import { Type } from 'class-transformer';
// Règles de validation : taille maximale et minimale d'une liste, liste, valeur parmi un choix, champ facultatif, texte, longueur maximale et minimale, validation des objets imbriqués.
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

// Fournisseurs proposés.
const PROVIDERS = ['claude', 'mistral'] as const;

/** Un fournisseur proposé à l'utilisateur. */
export class AssistantProviderDto {
  @ApiProperty({ enum: PROVIDERS, example: 'claude' }) id!: 'claude' | 'mistral';
  @ApiProperty({ example: 'Claude' }) label!: string;
  @ApiProperty({ example: 'claude-fable-5-2', description: 'Modèle utilisé : le plus performant du fournisseur.' }) model!: string;
  @ApiProperty({ example: 'https://platform.claude.com/settings/billing', description: 'Page d’ajout d’un moyen de paiement ou de crédit.' }) billingUrl!: string;
  @ApiProperty({ example: 'https://platform.claude.com/settings/keys', description: 'Page de création d’une clé d’API.' }) keysUrl!: string;
}

/** Réponse de GET assistant/config. */
export class AssistantCatalogDto {
  @ApiProperty({ type: [AssistantProviderDto] }) providers!: AssistantProviderDto[];
}

/** Corps de POST assistant/session (la clé est dans l'en-tête x-assistant-key). */
export class AssistantSessionRequestDto {
  @ApiProperty({ enum: PROVIDERS, example: 'mistral' })
  @IsIn(PROVIDERS as unknown as string[])
  provider!: 'claude' | 'mistral';
}

/** Réponse de POST assistant/session : la clé est valide et le compte peut payer. */
export class AssistantSessionDto {
  @ApiProperty({ enum: PROVIDERS, example: 'claude' }) provider!: 'claude' | 'mistral';
  @ApiProperty({ example: 'Claude' }) label!: string;
  @ApiProperty({ example: 'claude-fable-5-2', description: 'Modèle qui a répondu à l’appel de test.' }) model!: string;
}

// Forme d'un message de la conversation.
export class AssistantMessageDto {
  // Documente le champ suivant : deux valeurs possibles.
  @ApiProperty({ enum: ['user', 'assistant'] })
  // Validation : la valeur doit être « user » ou « assistant ».
  @IsIn(['user', 'assistant'])
  // role : qui parle, le visiteur ou l'assistant.
  role!: 'user' | 'assistant';

  // Documente le champ suivant : exemple et longueur maximale.
  @ApiProperty({ example: 'Quelle est la plus grande lune du système solaire ?', maxLength: 1000 })
  // Validation : un texte de 1 à 1 000 caractères.
  @IsString() @MinLength(1) @MaxLength(1000)
  // content : le texte du message.
  content!: string;
// Fin de AssistantMessageDto.
}

/**
 * Forme d'un élément de l'inventaire du DOM, relevé par le navigateur et envoyé avec le message : c'est ainsi que
 * le modèle voit l'écran. Il désigne ensuite un élément par son identifiant, et le navigateur le clique.
 */
// Forme d'un élément actionnable de la page.
export class AssistantElementDto {
  // Documente le champ suivant : l'identifiant du relevé.
  @ApiProperty({ example: 'e12', description: 'Identifiant dans ce relevé (e1, e2…).', maxLength: 8 })
  // Validation : un texte de 1 à 8 caractères.
  @IsString() @MinLength(1) @MaxLength(8)
  // id : son identifiant.
  id!: string;

  // Documente le champ suivant : son libellé.
  @ApiProperty({ example: 'Faire un don', maxLength: 60 })
  // Validation : un texte de 1 à 60 caractères.
  @IsString() @MinLength(1) @MaxLength(60)
  // label : son libellé affiché ou accessible.
  label!: string;

  // Documente le champ suivant : son rôle.
  @ApiProperty({ example: 'button', maxLength: 20 })
  // Validation : un texte de 1 à 20 caractères.
  @IsString() @MinLength(1) @MaxLength(20)
  // role : son rôle.
  role!: string;

  // Documente le champ suivant : son état, facultatif.
  @ApiPropertyOptional({ example: 'coché', maxLength: 40 })
  // Validation : un texte de 40 caractères au plus, absent possible.
  @IsOptional() @IsString() @MaxLength(40)
  // state : son état, s'il en a un.
  state?: string;
// Fin de AssistantElementDto.
}

// Forme du corps de POST assistant/messages (la clé est dans l'en-tête x-assistant-key).
export class AssistantRequestDto {
  @ApiProperty({ enum: PROVIDERS, example: 'claude', description: 'Fournisseur auquel l’utilisateur s’est connecté.' })
  @IsIn(PROVIDERS as unknown as string[])
  provider!: 'claude' | 'mistral';

  // Documente le champ suivant : une liste de messages.
  @ApiProperty({ type: [AssistantMessageDto], description: 'Conversation, du plus ancien au plus récent (12 messages au plus) ; le dernier vient du visiteur.' })
  // Validation : une liste de 1 à 12 éléments.
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12)
  // Validation : chaque élément est vérifié comme un AssistantMessageDto, après conversion dans cette classe.
  @ValidateNested({ each: true }) @Type(() => AssistantMessageDto)
  // messages : la conversation, du plus ancien au plus récent.
  messages!: AssistantMessageDto[];

  // Documente le champ suivant : l'inventaire des éléments actionnables.
  @ApiPropertyOptional({ type: [AssistantElementDto], description: 'Éléments actionnables présents à l’écran (120 au plus) : c’est par eux que le modèle agit sur la page.' })
  // Validation : une liste facultative de 120 éléments au plus.
  @IsOptional() @IsArray() @ArrayMaxSize(120)
  // Validation : chaque élément est vérifié comme un AssistantElementDto.
  @ValidateNested({ each: true }) @Type(() => AssistantElementDto)
  // elements : l'inventaire du DOM.
  elements?: AssistantElementDto[];
// Fin de AssistantRequestDto.
}

// Forme d'une action que l'assistant demande à l'interface.
export class AssistantActionDto {
  // name : le nom de l'action.
  @ApiProperty({ example: 'aller_a_un_astre', description: 'Action d’interface (voir assistant-tools.ts).' }) name!: string;
  // input : ses paramètres, un objet dont chaque valeur est un texte, un nombre ou un booléen.
  @ApiProperty({ example: { astre: 'Titan' }, description: 'Paramètres de l’action : texte, nombre ou booléen.' }) input!: Record<string, string | number | boolean>;
// Fin de AssistantActionDto.
}

// Forme de la réponse de l'assistant.
export class AssistantReplyDto {
  // reply : le texte de la réponse.
  @ApiProperty({ example: 'Je vous emmène sur Titan.', description: 'Texte de la réponse (peut être vide si l’assistant ne fait qu’agir).' }) reply!: string;
  // actions : les actions à exécuter dans l'interface, dans l'ordre.
  @ApiProperty({ type: [AssistantActionDto], description: 'Actions à exécuter dans l’interface, dans l’ordre : boutons et réglages existants uniquement.' }) actions!: AssistantActionDto[];
  // provider et model : qui a répondu.
  @ApiProperty({ enum: PROVIDERS, example: 'claude' }) provider!: 'claude' | 'mistral';
  @ApiProperty({ example: 'claude-fable-5-2' }) model!: string;
// Fin de AssistantReplyDto.
}
