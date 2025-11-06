import { Message } from './interfaces/message.interface';
import { DigitalHumanStrategy } from './strategies/digital-human-strategy.abstract';

/**
 * DigitalHumanInstance manages a single conversation session
 * Tracks history, turn count, and generates responses
 */
export class DigitalHumanInstance {
  private history: Message[] = [];
  private turnCount: number = 0;
  private maxTurns: number = 10;

  constructor(
    private strategy: DigitalHumanStrategy,
    private persona: string,
    private scenario: string,
  ) {
    // Initialize with system prompt
    this.history.push({
      role: 'system',
      content: `${persona}\n${scenario}`,
      timestamp: new Date(),
    });
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.history];
  }

  /**
   * Get current turn count
   */
  getTurnCount(): number {
    return this.turnCount;
  }

  /**
   * Check if conversation should end
   */
  shouldEnd(): boolean {
    return (
      this.strategy.shouldEndCall(this.history) ||
      this.turnCount >= this.maxTurns
    );
  }

  /**
   * Generate a response (digital human speaks)
   */
  async generateResponse(agentUtterance?: string): Promise<string> {
    if (this.shouldEnd()) {
      throw new Error('Conversation has ended');
    }

    const response = await this.strategy.generateResponse(
      this.history,
      agentUtterance,
    );

    // Add to history
    this.history.push({
      role: 'user',
      content: response,
      timestamp: new Date(),
    });

    this.turnCount++;

    return response;
  }

  /**
   * Add agent's utterance to history
   */
  addAgentUtterance(utterance: string): void {
    this.history.push({
      role: 'assistant',
      content: utterance,
      timestamp: new Date(),
    });
  }

  /**
   * Reset conversation (for testing)
   */
  reset(): void {
    this.history = [
      {
        role: 'system',
        content: `${this.persona}\n${this.scenario}`,
        timestamp: new Date(),
      },
    ];
    this.turnCount = 0;
  }

  /**
   * Set max turns
   */
  setMaxTurns(maxTurns: number): void {
    this.maxTurns = maxTurns;
  }
}
