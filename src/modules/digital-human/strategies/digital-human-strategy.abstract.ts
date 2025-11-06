import { Message } from '../interfaces/message.interface';

/**
 * Abstract base class for Digital Human strategies
 * Each language implements this interface to provide language-specific behavior
 */
export abstract class DigitalHumanStrategy {
  /**
   * Generate system prompt for the LLM
   * @param persona - Persona identifier (e.g., 'polite_customer', 'frustrated_customer')
   * @param scenario - Scenario description or template
   * @returns System prompt string
   */
  abstract generateSystemPrompt(persona: string, scenario: string): string;

  /**
   * Generate a response based on conversation history
   * @param history - Conversation history
   * @param agentUtterance - The agent's last utterance (if any)
   * @returns Generated response text
   */
  abstract generateResponse(
    history: Message[],
    agentUtterance?: string,
  ): Promise<string>;

  /**
   * Determine if the call should end based on conversation history
   * @param history - Conversation history
   * @returns true if call should end
   */
  abstract shouldEndCall(history: Message[]): boolean;

  /**
   * Add natural speech patterns (filler words, pauses, etc.)
   * @param text - Original text
   * @returns Text with natural speech patterns added
   */
  abstract addNaturalSpeech(text: string): string;

  /**
   * Get filler words for this language/dialect
   * @returns Array of filler words
   */
  abstract getFillerWords(): string[];
}
