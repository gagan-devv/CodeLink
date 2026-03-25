/**
 * Prompt templates component
 * Provides quick access to common prompt templates
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  template: string;
  category: string;
}

const TEMPLATES: PromptTemplate[] = [
  {
    id: '1',
    title: 'Code Review',
    description: 'Request a code review',
    template: 'Please review this code for:\n- Best practices\n- Performance issues\n- Security concerns\n- Code style',
    category: 'Review',
  },
  {
    id: '2',
    title: 'Bug Fix',
    description: 'Report and fix a bug',
    template: 'I found a bug:\n\nSteps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:\n\nPlease help fix this issue.',
    category: 'Bug',
  },
  {
    id: '3',
    title: 'Refactor',
    description: 'Request code refactoring',
    template: 'Please refactor this code to:\n- Improve readability\n- Reduce complexity\n- Follow SOLID principles',
    category: 'Refactor',
  },
  {
    id: '4',
    title: 'Add Tests',
    description: 'Generate unit tests',
    template: 'Please add comprehensive unit tests for this code, including:\n- Happy path scenarios\n- Edge cases\n- Error handling',
    category: 'Testing',
  },
  {
    id: '5',
    title: 'Documentation',
    description: 'Add code documentation',
    template: 'Please add detailed documentation including:\n- Function/class descriptions\n- Parameter explanations\n- Return value descriptions\n- Usage examples',
    category: 'Docs',
  },
  {
    id: '6',
    title: 'Optimize Performance',
    description: 'Improve code performance',
    template: 'Please optimize this code for better performance:\n- Reduce time complexity\n- Minimize memory usage\n- Improve algorithm efficiency',
    category: 'Performance',
  },
];

export interface PromptTemplatesProps {
  onSelectTemplate: (template: string) => void;
}

export const PromptTemplates: React.FC<PromptTemplatesProps> = ({
  onSelectTemplate,
}) => {
  const categories = Array.from(new Set(TEMPLATES.map(t => t.category)));

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Quick Templates
      </Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {categories.map(category => (
          <Chip key={category} style={styles.categoryChip}>
            {category}
          </Chip>
        ))}
      </ScrollView>

      <ScrollView style={styles.templates}>
        {TEMPLATES.map(template => (
          <Card
            key={template.id}
            style={styles.templateCard}
            onPress={() => onSelectTemplate(template.template)}
          >
            <Card.Content>
              <View style={styles.templateHeader}>
                <Text variant="titleSmall">{template.title}</Text>
                <Chip size="small">{template.category}</Chip>
              </View>
              <Text variant="bodySmall" style={styles.description}>
                {template.description}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    marginBottom: 12,
    fontWeight: '600',
  },
  categories: {
    marginBottom: 16,
    maxHeight: 40,
  },
  categoryChip: {
    marginRight: 8,
  },
  templates: {
    flex: 1,
  },
  templateCard: {
    marginBottom: 12,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  description: {
    color: '#666',
  },
});
